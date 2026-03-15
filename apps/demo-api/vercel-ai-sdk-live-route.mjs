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
  buildContinuumExecutionPlannerSystemPrompt,
  buildContinuumExecutionPlannerUserPrompt,
  buildContinuumPatchTargetCatalog,
  buildContinuumSystemPrompt,
  buildContinuumUserPrompt,
  coerceContinuumViewDefinition,
  extractLatestUserInstruction,
  formatRouteError,
  getAvailableContinuumExecutionModes,
  isVercelAiSdkLivePath,
  methodNotAllowed,
  parseContinuumExecutionPlan,
  parseContinuumStateResponse,
  parseContinuumViewDefinition,
  parseContinuumModelResponse,
  normalizeContinuumViewIdentity,
  resolveLiveProvider,
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
  const patchTargets = buildContinuumPatchTargetCatalog(currentView);
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
      const availableExecutionModes = getAvailableContinuumExecutionModes({
        currentView,
        stateTargets,
      });

      const repairFullViewGeneration = async (invalidText, validationErrors = []) => {
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
            validationErrors.length > 0
              ? ['', 'Validation errors:', JSON.stringify(validationErrors, null, 2)]
                  .flat()
                  .join('\n')
              : '',
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

      const repairStatePopulation = async (invalidText, selectedTargets = []) => {
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
            'Planner-selected targets:',
            JSON.stringify(selectedTargets, null, 2),
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

      const repairPatchGeneration = async (invalidText, selectedTargets = []) => {
        writer.write({
          type: 'data-continuum-status',
          data: {
            status:
              'Patch mode drifted away from valid localized Continuum operations. Repairing it into update parts before apply...',
            level: 'warning',
          },
          transient: true,
        });

        const repair = await generateText({
          model: resolvedProvider.languageModel,
          system: buildContinuumSystemPrompt({ mode: 'patch' }),
          prompt: [
            'Repair the previous model output into a valid Continuum patch response JSON object.',
            'Return JSON only.',
            'Return kind="patch".',
            'Do not return a full view.',
            'Use the smallest valid operation list that satisfies the request.',
            'If the request is "add a secondary email", that should normally be one insert-node near the existing email field.',
            '',
            buildContinuumUserPrompt(
              {
                instruction,
                currentView,
              },
              { mode: 'patch' }
            ),
            '',
            'Planner-selected localized targets:',
            JSON.stringify(selectedTargets, null, 2),
            '',
            'Previous invalid output:',
            invalidText,
          ].join('\n'),
          maxOutputTokens: 2500,
        });

        const repaired = parseContinuumModelResponse({
          text: repair.text,
          fallbackView: currentView,
        });

        return repaired?.kind === 'parts' ? repaired : null;
      };

      const runStatePopulation = async (selectedTargets = []) => {
        const result = await generateText({
          model: resolvedProvider.languageModel,
          system: buildContinuumSystemPrompt({ mode: 'state' }),
          prompt: [
            buildContinuumUserPrompt(
              {
                instruction,
                currentData,
                stateTargets,
              },
              { mode: 'state' }
            ),
            '',
            'Planner-selected targets:',
            JSON.stringify(selectedTargets, null, 2),
          ].join('\n'),
          maxOutputTokens: 2500,
        });

        const parsed = parseContinuumStateResponse({
          text: result.text,
          targetCatalog: stateTargets,
        });

        if (parsed) {
          return parsed;
        }

        return repairStatePopulation(result.text, selectedTargets);
      };

      const runFullViewGeneration = async ({
        announceStreaming = true,
        maxOutputTokens = 4000,
      } = {}) => {
        let hasPreviewedDraft = false;
        let previewDraftSequence = 0;
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
              id: 'continuum-preview-status',
              type: 'data-continuum-status',
              data: {
                status:
                  'Streaming draft Continuum view snapshots into a non-live preview stream...',
                level: 'info',
              },
              transient: true,
            });
          }

          if (announceStreaming) {
            writer.write({
              id: `continuum-preview-view-${previewDraftSequence + 1}`,
              type: 'data-continuum-view',
              data: {
                view: previewView,
                streamMode: 'draft',
              },
              transient: true,
            });
            previewDraftSequence += 1;
          }

          hasPreviewedDraft = true;
          lastPreviewMetrics = metrics;
          lastPreviewAt = Date.now();
          pendingGeneratedText = '';
          return true;
        };

        const finalizeGeneratedView = async (candidateView) => {
          if (!candidateView) {
            return null;
          }

          const normalizedIdentity = normalizeContinuumViewIdentity({
            currentView,
            nextView: candidateView,
          });

          if (normalizedIdentity.errors.length === 0 && normalizedIdentity.view) {
            return normalizedIdentity.view;
          }

          writer.write({
            type: 'data-continuum-status',
            data: {
              status:
                'The generated view broke Continuum semantic identity rules. Repairing it before apply...',
              level: 'warning',
            },
            transient: true,
          });

          const repairedView = await repairFullViewGeneration(
            JSON.stringify(candidateView, null, 2),
            normalizedIdentity.errors
          );
          if (!repairedView) {
            return null;
          }

          const repairedIdentity = normalizeContinuumViewIdentity({
            currentView,
            nextView: repairedView,
          });

          return repairedIdentity.errors.length === 0
            ? repairedIdentity.view
            : null;
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
            return finalizeGeneratedView(parsedView);
          }

          const partial = await parsePartialJson(generatedText);
          const coercedPartialView = coerceContinuumViewDefinition(
            partial.value,
            currentView
          );

          if (coercedPartialView) {
            return finalizeGeneratedView(coercedPartialView);
          }

          const repairedView = await repairFullViewGeneration(generatedText);
          return finalizeGeneratedView(repairedView);
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
          return finalizeGeneratedView(
            coerceContinuumViewDefinition(completedOutput, currentView)
          );
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

        const planExecutionMode = async () => {
          if (availableExecutionModes.length === 1) {
            return {
              mode: availableExecutionModes[0],
              fallback: 'view',
              targetNodeIds: [],
              targetSemanticKeys: [],
              validation: 'accepted',
              reason: 'only available mode',
            };
          }

        writer.write({
          type: 'data-continuum-status',
          data: {
            status:
              'Planning the fastest Continuum execution path for this request...',
            level: 'info',
          },
          transient: true,
        });

        const plan = await generateText({
          model: resolvedProvider.languageModel,
          system: buildContinuumExecutionPlannerSystemPrompt(),
          prompt: buildContinuumExecutionPlannerUserPrompt({
            instruction,
            currentView,
            currentData,
            stateTargets,
          }),
          temperature: 0,
          maxOutputTokens: 120,
        });

        const parsedPlan = parseContinuumExecutionPlan({
          text: plan.text,
          currentView,
          stateTargets,
        });

        if (parsedPlan.validation !== 'accepted') {
          writer.write({
            type: 'data-continuum-status',
            data: {
              status:
                'The planner returned an invalid or unsafe execution target, so the route escalated to full-view generation for safety.',
              level: 'warning',
            },
            transient: true,
          });
        }

        return parsedPlan;
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

        const executionPlan = await planExecutionMode();

        writer.write({
          type: 'data-continuum-status',
          data: {
            status:
              executionPlan.mode === 'state'
                ? `Planner chose state mode${executionPlan.reason ? `: ${executionPlan.reason}.` : '.'}`
                : executionPlan.mode === 'patch'
                  ? `Planner chose targeted patch mode${executionPlan.reason ? `: ${executionPlan.reason}.` : '.'}`
                  : `Planner chose full-view mode${executionPlan.reason ? `: ${executionPlan.reason}.` : '.'}`,
            level: 'info',
          },
          transient: true,
        });

        const selectedExecutionTargets = [
          ...(Array.isArray(executionPlan.targetNodeIds)
            ? executionPlan.targetNodeIds
            : []),
          ...(Array.isArray(executionPlan.targetSemanticKeys)
            ? executionPlan.targetSemanticKeys
            : []),
        ];

        if (executionPlan.mode === 'state') {
          writer.write({
            type: 'data-continuum-status',
            data: {
              status:
                'Using state population mode so the existing form receives real values instead of a rewritten view.',
              level: 'info',
            },
            transient: true,
          });

          const response = await runStatePopulation(selectedExecutionTargets);

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

        if (executionPlan.mode === 'patch') {
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
            prompt: [
              buildContinuumUserPrompt(
                {
                  instruction,
                  currentView,
                },
                { mode: 'patch' }
              ),
              '',
              'Planner-selected localized targets:',
              JSON.stringify(selectedExecutionTargets, null, 2),
            ].join('\n'),
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

          let localizedResponse =
            response?.kind === 'parts'
              ? response
              : await repairPatchGeneration(
                  generatedText,
                  selectedExecutionTargets
                );

          if (!localizedResponse) {
            writer.write({
              type: 'data-continuum-status',
              data: {
                status:
                  'Patch mode did not produce a valid localized edit. Regenerating the next view in one shot so populated fields do not appear to clear during preview...',
                level: 'info',
              },
              transient: true,
            });

            const fallbackView = await runFullViewGeneration({
              announceStreaming: false,
            });

            if (!fallbackView) {
              const parseError =
                'The model response did not contain valid Continuum update parts or a fallback view. The session was left unchanged.';

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
                streamMode: 'draft',
              },
            });
            writer.write({
              type: 'data-continuum-status',
              data: {
                status: `Applied a live ${resolvedProvider.provider.label} view update after patch mode fell back to a one-shot draft-commit view path.`,
                level: 'success',
              },
            });
            return;
          }

          for (const part of localizedResponse.parts) {
            if (part.kind === 'insert-node') {
              writer.write({
                type: 'data-continuum-insert-node',
                data: {
                  node: part.node,
                  ...(typeof part.parentId === 'string'
                    ? { parentId: part.parentId }
                    : {}),
                  ...(part.parentId === null ? { parentId: null } : {}),
                  ...(part.position ? { position: part.position } : {}),
                  ...(localizedResponse.viewId
                    ? { targetViewId: localizedResponse.viewId }
                    : {}),
                },
              });
              continue;
            }

            if (part.kind === 'replace-node') {
              writer.write({
                type: 'data-continuum-replace-node',
                data: {
                  nodeId: part.nodeId,
                  node: part.node,
                  ...(localizedResponse.viewId
                    ? { targetViewId: localizedResponse.viewId }
                    : {}),
                },
              });
              continue;
            }

            if (part.kind === 'remove-node') {
              writer.write({
                type: 'data-continuum-remove-node',
                data: {
                  nodeId: part.nodeId,
                  ...(localizedResponse.viewId
                    ? { targetViewId: localizedResponse.viewId }
                    : {}),
                },
              });
              continue;
            }

            if (part.kind === 'append-content') {
              writer.write({
                type: 'data-continuum-append-content',
                data: {
                  nodeId: part.nodeId,
                  text: part.text,
                  ...(localizedResponse.viewId
                    ? { targetViewId: localizedResponse.viewId }
                    : {}),
                },
              });
              continue;
            }

            if (part.kind === 'move-node' || part.kind === 'wrap-nodes') {
              writer.write({
                type: 'data-continuum-patch',
                data: {
                  patch: {
                    ...(localizedResponse.viewId
                      ? { viewId: localizedResponse.viewId }
                      : {}),
                    ...(localizedResponse.version
                      ? { version: localizedResponse.version }
                      : {}),
                    operations: [
                      part.kind === 'move-node'
                        ? {
                            op: 'move-node',
                            nodeId: part.nodeId,
                            ...(typeof part.parentId === 'string'
                              ? { parentId: part.parentId }
                              : {}),
                            ...(part.parentId === null ? { parentId: null } : {}),
                            ...(part.position ? { position: part.position } : {}),
                          }
                        : {
                            op: 'wrap-nodes',
                            ...(typeof part.parentId === 'string'
                              ? { parentId: part.parentId }
                              : {}),
                            ...(part.parentId === null ? { parentId: null } : {}),
                            nodeIds: part.nodeIds,
                            wrapper: part.wrapper,
                          },
                    ],
                  },
                },
              });
            }
          }

          writer.write({
            type: 'data-continuum-status',
            data: {
              status: `Applied live ${resolvedProvider.provider.label} Continuum update operations without regenerating the whole view.`,
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
            streamMode: 'draft',
          },
        });
        writer.write({
          type: 'data-continuum-status',
          data: {
            status: `Applied a live ${resolvedProvider.provider.label} view update through a draft commit. Continuum kept reconciliation on the client.`,
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
