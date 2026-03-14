import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  Output,
  parsePartialJson,
  streamText,
} from 'ai';
import {
  buildContinuumStateTargetCatalog,
  CONTINUUM_VIEW_OUTPUT_SCHEMA,
  VERCEL_AI_SDK_LIVE_PATH,
  buildContinuumSystemPrompt,
  buildContinuumUserPrompt,
  coerceContinuumViewDefinition,
  extractLatestUserInstruction,
  formatRouteError,
  isVercelAiSdkLivePath,
  methodNotAllowed,
  parseContinuumStateResponse,
  parseContinuumViewDefinition,
  parseContinuumModelResponse,
  resolveLiveProvider,
  shouldPreferContinuumState,
  shouldPreferContinuumPatch,
  textErrorResponse,
} from './vercel-ai-sdk-shared.mjs';

export { isVercelAiSdkLivePath };

export { VERCEL_AI_SDK_LIVE_PATH };

function countViewNodes(nodes) {
  if (!Array.isArray(nodes)) {
    return 0;
  }

  return nodes.reduce((total, node) => {
    if (!node || typeof node !== 'object') {
      return total;
    }

    return (
      total +
      1 +
      countViewNodes(node.children) +
      countViewNodes(node.template ? [node.template] : [])
    );
  }, 0);
}

function measurePreviewView(view) {
  const signature = JSON.stringify(view);

  return {
    signature,
    serializedLength: signature.length,
    nodeCount: countViewNodes(view?.nodes),
  };
}

function shouldEmitPreviewDraft(nextMetrics, previousMetrics) {
  if (nextMetrics.nodeCount === 0 || nextMetrics.serializedLength === 0) {
    return false;
  }

  if (!previousMetrics) {
    return true;
  }

  if (nextMetrics.signature === previousMetrics.signature) {
    return false;
  }

  if (nextMetrics.nodeCount < previousMetrics.nodeCount) {
    return false;
  }

  if (
    nextMetrics.nodeCount === previousMetrics.nodeCount &&
    nextMetrics.serializedLength + 32 < previousMetrics.serializedLength
  ) {
    return false;
  }

  return true;
}

export async function handleVercelAiSdkLiveRequest(request, env = {}) {
  if (request.method !== 'POST') {
    return methodNotAllowed('POST');
  }

  const body = await request.json().catch(() => null);
  const instruction = extractLatestUserInstruction(body?.messages);

  if (!instruction) {
    return textErrorResponse(
      400,
      'Add an instruction before sending a live Vercel AI SDK request.'
    );
  }

  const currentView =
    body?.currentView && typeof body.currentView === 'object'
      ? body.currentView
      : undefined;
  const currentData =
    body?.currentData && typeof body.currentData === 'object'
      ? body.currentData
      : undefined;
  const stateTargets = buildContinuumStateTargetCatalog(currentView);
  const providerId =
    typeof body?.providerId === 'string' ? body.providerId : 'openai';
  const requestedModel =
    typeof body?.model === 'string' ? body.model : undefined;

  let resolvedProvider;
  try {
    resolvedProvider = resolveLiveProvider({
      providerId,
      model: requestedModel,
      headers: request.headers,
      env,
    });
  } catch (error) {
    return textErrorResponse(
      400,
      formatRouteError(error, 'Unable to resolve the requested provider.')
    );
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const preferState = shouldPreferContinuumState(instruction);
      const preferPatch = shouldPreferContinuumPatch(instruction);

      const repairFullViewGeneration = async (invalidText) => {
        writer.write({
          type: 'data-continuum-status',
          data: {
            status:
              'The streamed response drifted away from valid Continuum JSON. Repairing it before apply...',
            level: 'warning',
          },
          transient: true,
        });

        const repair = await generateText({
          model: resolvedProvider.languageModel,
          system: buildContinuumSystemPrompt({ mode: 'view' }),
          prompt: [
            'Repair the previous model output into a valid Continuum ViewDefinition JSON response.',
            'Return JSON only.',
            '',
            'Current view:',
            JSON.stringify(currentView ?? null, null, 2),
            '',
            'Instruction:',
            instruction,
            '',
            'Previous invalid output:',
            invalidText,
          ].join('\n'),
          maxOutputTokens: 4000,
        });

        return parseContinuumViewDefinition({
          text: repair.text,
          fallbackView: currentView,
        });
      };

      const repairStatePopulation = async (invalidText) => {
        writer.write({
          type: 'data-continuum-status',
          data: {
            status:
              'The population response drifted away from valid Continuum state JSON. Repairing it before apply...',
            level: 'warning',
          },
          transient: true,
        });

        const repair = await generateText({
          model: resolvedProvider.languageModel,
          system: buildContinuumSystemPrompt({ mode: 'state' }),
          prompt: [
            'Repair the previous model output into a valid Continuum state response JSON object.',
            'Return JSON only.',
            '',
            'State targets:',
            JSON.stringify(stateTargets, null, 2),
            '',
            'Current state values:',
            JSON.stringify(currentData ?? null, null, 2),
            '',
            'Instruction:',
            instruction,
            '',
            'Previous invalid output:',
            invalidText,
          ].join('\n'),
          maxOutputTokens: 2500,
        });

        return parseContinuumStateResponse({
          text: repair.text,
          targetCatalog: stateTargets,
        });
      };

      const runStatePopulation = async () => {
        const result = await generateText({
          model: resolvedProvider.languageModel,
          system: buildContinuumSystemPrompt({ mode: 'state' }),
          prompt: buildContinuumUserPrompt(
            {
              instruction,
              currentData,
              stateTargets,
            },
            { mode: 'state' }
          ),
          maxOutputTokens: 2500,
        });

        const parsed = parseContinuumStateResponse({
          text: result.text,
          targetCatalog: stateTargets,
        });

        if (parsed) {
          return parsed;
        }

        return repairStatePopulation(result.text);
      };

      const runFullViewGeneration = async ({
        announceStreaming = true,
        maxOutputTokens = 4000,
      } = {}) => {
        let hasPreviewedDraft = false;
        let lastPreviewMetrics = null;
        let lastPreviewAt = 0;
        let pendingGeneratedText = '';
        const previewIntervalMs = 650;

        const emitPreview = (previewView) => {
          const metrics = measurePreviewView(previewView);
          if (!shouldEmitPreviewDraft(metrics, lastPreviewMetrics)) {
            return false;
          }

          if (announceStreaming && !hasPreviewedDraft) {
            writer.write({
              type: 'data-continuum-status',
              data: {
                status:
                  'Streaming draft Continuum view snapshots into the client preview...',
                level: 'info',
              },
              transient: true,
            });
          }

          if (announceStreaming) {
            writer.write({
              type: 'data-continuum-view',
              data: {
                view: previewView,
              },
              transient: true,
            });
          }

          hasPreviewedDraft = true;
          lastPreviewMetrics = metrics;
          lastPreviewAt = Date.now();
          pendingGeneratedText = '';
          return true;
        };

        const runTextViewGeneration = async () => {
          const result = streamText({
            model: resolvedProvider.languageModel,
            system: buildContinuumSystemPrompt({ mode: 'view' }),
            prompt: buildContinuumUserPrompt(
              {
                instruction,
                currentView,
              },
              { mode: 'view' }
            ),
            maxOutputTokens,
          });

          let generatedText = '';

          const maybePreviewFromText = async (text) => {
            if (!announceStreaming || !text.trim()) {
              return;
            }

            const partial = await parsePartialJson(text);
            const previewView = coerceContinuumViewDefinition(
              partial.value,
              currentView
            );

            if (!previewView) {
              return;
            }

            emitPreview(previewView);
          };

          for await (const textDelta of result.textStream) {
            generatedText += textDelta;

            if (!announceStreaming) {
              continue;
            }

            if (Date.now() - lastPreviewAt < previewIntervalMs) {
              pendingGeneratedText = generatedText;
              continue;
            }

            await maybePreviewFromText(generatedText);
          }

          if (announceStreaming && pendingGeneratedText) {
            await maybePreviewFromText(pendingGeneratedText);
          }

          const parsedView = parseContinuumViewDefinition({
            text: generatedText,
            fallbackView: currentView,
          });

          if (parsedView) {
            return parsedView;
          }

          const partial = await parsePartialJson(generatedText);
          const coercedPartialView = coerceContinuumViewDefinition(
            partial.value,
            currentView
          );

          if (coercedPartialView) {
            return coercedPartialView;
          }

          return repairFullViewGeneration(generatedText);
        };

        const runAnthropicStructuredViewGeneration = async () => {
          const result = streamText({
            model: resolvedProvider.languageModel,
            system: buildContinuumSystemPrompt({ mode: 'view' }),
            prompt: buildContinuumUserPrompt(
              {
                instruction,
                currentView,
              },
              { mode: 'view' }
            ),
            output: Output.object({
              schema: CONTINUUM_VIEW_OUTPUT_SCHEMA,
              name: 'continuum_view_definition',
              description:
                'A complete Continuum ViewDefinition representing the next client-side UI.',
            }),
            providerOptions: {
              anthropic: {
                structuredOutputMode: 'jsonTool',
                toolStreaming: true,
              },
            },
            maxOutputTokens,
          });

          for await (const partialOutput of result.partialOutputStream) {
            if (!announceStreaming) {
              continue;
            }

            const previewView = coerceContinuumViewDefinition(
              partialOutput,
              currentView
            );

            if (!previewView) {
              continue;
            }

            emitPreview(previewView);
          }

          const completedOutput = await result.output;
          return coerceContinuumViewDefinition(completedOutput, currentView);
        };

        if (resolvedProvider.provider.id === 'anthropic') {
          try {
            return await runAnthropicStructuredViewGeneration();
          } catch {
            writer.write({
              type: 'data-continuum-status',
              data: {
                status:
                  'Claude structured view streaming fell back to the text JSON path for this request.',
                level: 'warning',
              },
              transient: true,
            });
          }
        }

        return runTextViewGeneration();
      };

      writer.write({
        type: 'data-continuum-status',
        data: {
          status: `Preparing a ${resolvedProvider.provider.label} view update in ${resolvedProvider.modelId}...`,
          level: 'info',
        },
        transient: true,
      });

      try {
        writer.write({
          type: 'data-continuum-status',
          data: {
            status:
              resolvedProvider.keySource === 'request'
                ? `Streaming provider output with your API key from the browser...`
              : `Streaming provider output with the Worker-configured key...`,
            level: 'info',
          },
          transient: true,
        });

        if (preferState) {
          writer.write({
            type: 'data-continuum-status',
            data: {
              status:
                'Using state population mode so the existing form receives real values instead of a rewritten view.',
              level: 'info',
            },
            transient: true,
          });

          const response = await runStatePopulation();

          if (!response || !Array.isArray(response.updates) || response.updates.length === 0) {
            const stateError =
              'The model response did not contain valid Continuum state updates. The session was left unchanged.';

            writer.write({
              type: 'data-continuum-status',
              data: {
                status: stateError,
                level: 'error',
              },
            });
            writer.write({
              type: 'error',
              errorText: stateError,
            });
            return;
          }

          for (const update of response.updates) {
            writer.write({
              type: 'data-continuum-state',
              data: update,
            });
          }

          writer.write({
            type: 'data-continuum-status',
            data: {
              status:
                response.status ??
                `Applied ${response.updates.length} live ${resolvedProvider.provider.label} state update${
                  response.updates.length === 1 ? '' : 's'
                } into the current Continuum session.`,
              level: 'success',
            },
          });
          return;
        }

        if (preferPatch) {
          writer.write({
            type: 'data-continuum-status',
            data: {
              status:
                'Using targeted patch mode for a localized edit request.',
              level: 'info',
            },
            transient: true,
          });

          const result = streamText({
            model: resolvedProvider.languageModel,
            system: buildContinuumSystemPrompt({ mode: 'patch' }),
            prompt: buildContinuumUserPrompt(
              {
                instruction,
                currentView,
              },
              { mode: 'patch' }
            ),
            maxOutputTokens: 4000,
          });

          let generatedText = '';
          for await (const textDelta of result.textStream) {
            generatedText += textDelta;
          }

          const response = parseContinuumModelResponse({
            text: generatedText,
            fallbackView: currentView,
          });

          if (!response) {
            writer.write({
              type: 'data-continuum-status',
              data: {
                status:
                  'Patch mode did not produce a valid edit. Retrying as a streamed Continuum view update...',
                level: 'info',
              },
              transient: true,
            });

            const fallbackView = await runFullViewGeneration({
              announceStreaming: true,
            });

            if (!fallbackView) {
              const parseError =
                'The model response did not contain a valid Continuum patch or view. The session was left unchanged.';

              writer.write({
                type: 'data-continuum-status',
                data: {
                  status: parseError,
                  level: 'error',
                },
              });
              writer.write({
                type: 'error',
                errorText: parseError,
              });
              return;
            }

            writer.write({
              type: 'data-continuum-view',
              data: {
                view: fallbackView,
              },
            });
            writer.write({
              type: 'data-continuum-status',
              data: {
                status: `Applied a live ${resolvedProvider.provider.label} view update after patch mode fell back to the streamed view path.`,
                level: 'success',
              },
            });
            return;
          }

          if (response.kind === 'patch') {
            writer.write({
              type: 'data-continuum-patch',
              data: {
                patch: response.patch,
              },
            });
          } else {
            writer.write({
              type: 'data-continuum-view',
              data: {
                view: response.view,
              },
            });
          }

          writer.write({
            type: 'data-continuum-status',
            data: {
              status:
                response.kind === 'patch'
                  ? `Applied a live ${resolvedProvider.provider.label} patch suggestion. Continuum kept reconciliation on the client.`
                  : `Applied a live ${resolvedProvider.provider.label} view update. Continuum kept reconciliation on the client.`,
              level: 'success',
            },
          });
          return;
        }
        const nextView = await runFullViewGeneration({
          announceStreaming: true,
        });

        if (!nextView) {
          const parseError =
            'The model response did not contain a valid Continuum view. The session was left unchanged.';

          writer.write({
            type: 'data-continuum-status',
            data: {
              status: parseError,
              level: 'error',
            },
          });
          writer.write({
            type: 'error',
            errorText: parseError,
          });
          return;
        }

        writer.write({
          type: 'data-continuum-view',
          data: {
            view: nextView,
          },
        });
        writer.write({
          type: 'data-continuum-status',
          data: {
            status: `Applied a live ${resolvedProvider.provider.label} view update. Continuum kept reconciliation on the client.`,
            level: 'success',
          },
        });
      } catch (error) {
        const message = formatRouteError(
          error,
          'Live provider request failed before Continuum could apply a new view.'
        );

        writer.write({
          type: 'data-continuum-status',
          data: {
            status: message,
            level: 'error',
          },
        });
        writer.write({
          type: 'error',
          errorText: message,
        });
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
  });
}
