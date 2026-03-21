import { createUIMessageStream, createUIMessageStreamResponse, generateText, streamText, } from 'ai';
import { parseJson, streamContinuumExecution, } from '@continuum-dev/ai-engine';
import { resolveTemperatureForLanguageModel } from './lib/resolve-temperature-for-language-model.js';
function normalizeError(error) {
    return error instanceof Error ? error : new Error(String(error));
}
function textFromPart(part) {
    if (!part || typeof part !== 'object') {
        return '';
    }
    const candidate = part;
    if (candidate.type === 'text' && typeof candidate.text === 'string') {
        return candidate.text;
    }
    return '';
}
export function extractLatestUserInstruction(messages) {
    if (!Array.isArray(messages)) {
        return '';
    }
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || typeof message !== 'object') {
            continue;
        }
        if ('role' in message &&
            message.role === 'user' &&
            typeof message.content === 'string') {
            const content = message.content.trim();
            if (content) {
                return content;
            }
        }
        const parts = message.parts;
        if (!Array.isArray(parts)) {
            continue;
        }
        const combined = parts
            .map((part) => textFromPart(part))
            .join(' ')
            .trim();
        if (combined) {
            return combined;
        }
    }
    return '';
}
function toExecutionResponse(request, text, raw) {
    return {
        text,
        json: request.outputKind === 'json-object' ? parseJson(text) : null,
        raw,
    };
}
function mergeProviderOptions(baseOptions, requestOptions) {
    if (!baseOptions && !requestOptions) {
        return undefined;
    }
    return {
        ...(baseOptions ?? {}),
        ...(requestOptions ?? {}),
    };
}
function writeChunk(writer, chunk) {
    writer.write(chunk);
}
function toPatchOperation(operation) {
    if (!operation || typeof operation !== 'object') {
        return null;
    }
    const candidate = operation;
    if (candidate.kind === 'insert-node' && candidate.node) {
        return {
            op: 'insert-node',
            parentId: typeof candidate.parentId === 'string' || candidate.parentId === null
                ? candidate.parentId
                : undefined,
            position: candidate.position && typeof candidate.position === 'object'
                ? candidate.position
                : undefined,
            node: candidate.node,
        };
    }
    if (candidate.kind === 'move-node' &&
        typeof candidate.nodeId === 'string') {
        return {
            op: 'move-node',
            nodeId: candidate.nodeId,
            parentId: typeof candidate.parentId === 'string' || candidate.parentId === null
                ? candidate.parentId
                : undefined,
            position: candidate.position && typeof candidate.position === 'object'
                ? candidate.position
                : undefined,
        };
    }
    if (candidate.kind === 'wrap-nodes' &&
        Array.isArray(candidate.nodeIds) &&
        candidate.wrapper) {
        return {
            op: 'wrap-nodes',
            parentId: typeof candidate.parentId === 'string' || candidate.parentId === null
                ? candidate.parentId
                : undefined,
            nodeIds: candidate.nodeIds,
            wrapper: candidate.wrapper,
        };
    }
    if (candidate.kind === 'replace-node' &&
        typeof candidate.nodeId === 'string' &&
        candidate.node) {
        return {
            op: 'replace-node',
            nodeId: candidate.nodeId,
            node: candidate.node,
        };
    }
    if (candidate.kind === 'remove-node' &&
        typeof candidate.nodeId === 'string') {
        return {
            op: 'remove-node',
            nodeId: candidate.nodeId,
        };
    }
    return null;
}
function normalizeMutationlessExecutionResult(result, wroteMutation) {
    if (wroteMutation || result.mode === 'noop' || result.level !== 'success') {
        return result;
    }
    return {
        mode: 'noop',
        source: result.source,
        status: result.mode === 'patch'
            ? 'Patch update could not be applied; no changes were made.'
            : result.mode === 'transform'
                ? 'Transform update could not be applied; no changes were made.'
                : 'Continuum completed without applying any changes.',
        level: 'warning',
        trace: result.trace,
        requestedMode: result.mode,
        reason: `The ${result.mode} result did not emit any mutation parts to the UI stream.`,
    };
}
function writeExecutionEvent(writer, event, viewStreamMode) {
    if (event.kind === 'status') {
        writeChunk(writer, {
            type: 'data-continuum-status',
            data: {
                status: event.status,
                level: event.level,
            },
            transient: event.level === 'info' || event.level === 'warning',
        });
        return { wroteMutation: false };
    }
    if (event.kind === 'state') {
        writeChunk(writer, {
            type: 'data-continuum-state',
            data: {
                nodeId: event.update.nodeId,
                value: event.update.value,
            },
        });
        return { wroteMutation: true };
    }
    if (event.kind === 'patch') {
        const operations = [];
        let wroteMutation = false;
        for (const operation of event.patchPlan.operations) {
            if (operation.kind === 'append-content') {
                writeChunk(writer, {
                    type: 'data-continuum-append-content',
                    data: {
                        nodeId: operation.nodeId,
                        text: operation.text,
                        targetViewId: event.currentView.viewId,
                    },
                });
                wroteMutation = true;
                continue;
            }
            const patchOperation = toPatchOperation(operation);
            if (patchOperation) {
                operations.push(patchOperation);
            }
        }
        if (operations.length > 0) {
            const patch = {
                viewId: event.currentView.viewId,
                version: event.currentView.version,
                operations,
            };
            writeChunk(writer, {
                type: 'data-continuum-patch',
                data: {
                    patch,
                },
            });
            wroteMutation = true;
        }
        return { wroteMutation };
    }
    if (event.kind === 'view-preview') {
        writeChunk(writer, {
            type: 'data-continuum-view',
            data: {
                view: event.view,
                streamMode: viewStreamMode,
            },
            transient: true,
        });
        return { wroteMutation: true };
    }
    if (event.kind === 'view-final') {
        writeChunk(writer, {
            type: 'data-continuum-view',
            data: {
                view: event.view,
                ...(event.transformPlan
                    ? { transformPlan: event.transformPlan }
                    : {}),
                streamMode: viewStreamMode,
            },
        });
        return { wroteMutation: true };
    }
    return { wroteMutation: false };
}
async function resolveRouteAdapter(options, request, body) {
    if (options.resolveAdapter) {
        return options.resolveAdapter({ request, body });
    }
    if (options.adapter) {
        return options.adapter;
    }
    throw new Error('No Continuum execution adapter was configured for this Vercel AI SDK route.');
}
export function createVercelAiSdkContinuumExecutionAdapter(options) {
    async function resolveModel(request) {
        if (options.resolveModel) {
            return options.resolveModel(request);
        }
        if (options.model) {
            return options.model;
        }
        throw new Error('No Vercel AI SDK model was provided.');
    }
    return {
        label: options.label ?? 'Vercel AI SDK',
        async generate(request) {
            const model = await resolveModel(request);
            const providerOptions = mergeProviderOptions(options.providerOptions, await options.resolveProviderOptions?.(request));
            const result = await generateText({
                model,
                system: request.systemPrompt,
                prompt: request.userMessage,
                temperature: resolveTemperatureForLanguageModel(model, request.temperature),
                maxOutputTokens: request.maxTokens,
                providerOptions: mergeProviderOptions(providerOptions, request.providerOptions),
            });
            return toExecutionResponse(request, result.text, result);
        },
        async *streamText(request) {
            const model = await resolveModel(request);
            const providerOptions = mergeProviderOptions(options.providerOptions, await options.resolveProviderOptions?.(request));
            const result = streamText({
                model,
                system: request.systemPrompt,
                prompt: request.userMessage,
                temperature: resolveTemperatureForLanguageModel(model, request.temperature),
                maxOutputTokens: request.maxTokens,
                providerOptions: mergeProviderOptions(providerOptions, request.providerOptions),
            });
            for await (const chunk of result.textStream) {
                yield chunk;
            }
        },
    };
}
export async function writeContinuumExecutionToUiMessageWriter(args) {
    const iterator = streamContinuumExecution({
        adapter: args.adapter,
        instruction: args.instruction,
        context: args.context,
        mode: args.mode,
        addons: args.addons,
        outputContract: args.outputContract,
        authoringFormat: args.authoringFormat,
        autoApplyView: args.autoApplyView,
    });
    let next = await iterator.next();
    let wroteMutation = false;
    while (!next.done) {
        if (next.value.kind !== 'error') {
            const writeResult = writeExecutionEvent(args.writer, next.value, args.viewStreamMode ?? 'draft');
            wroteMutation = wroteMutation || writeResult.wroteMutation;
        }
        next = await iterator.next();
    }
    return normalizeMutationlessExecutionResult(next.value, wroteMutation);
}
export function createContinuumUiMessageStream(args) {
    return createUIMessageStream({
        execute: async ({ writer }) => {
            try {
                const result = await writeContinuumExecutionToUiMessageWriter({
                    writer,
                    adapter: args.adapter,
                    instruction: args.instruction,
                    context: args.context,
                    mode: args.mode,
                    addons: args.addons,
                    outputContract: args.outputContract,
                    authoringFormat: args.authoringFormat,
                    autoApplyView: args.autoApplyView,
                    viewStreamMode: args.viewStreamMode,
                });
                if (args.writeFinalStatus ?? true) {
                    writeChunk(writer, {
                        type: 'data-continuum-status',
                        data: {
                            status: result.status,
                            level: result.level,
                        },
                    });
                }
                await args.onResult?.(result, writer);
            }
            catch (error) {
                const normalized = normalizeError(error);
                if (args.writeFinalStatus ?? true) {
                    writeChunk(writer, {
                        type: 'data-continuum-status',
                        data: {
                            status: normalized.message,
                            level: 'error',
                        },
                    });
                }
                if (args.writeErrorPart ?? true) {
                    writeChunk(writer, {
                        type: 'error',
                        errorText: normalized.message,
                    });
                }
                await args.onError?.(normalized, writer);
            }
        },
    });
}
export function createContinuumVercelAiSdkRouteHandler(options) {
    return async function handleContinuumVercelAiSdkRoute(request) {
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: {
                    allow: 'POST',
                },
            });
        }
        const body = (await request
            .json()
            .catch(() => null));
        if (!body || typeof body !== 'object') {
            return new Response('Invalid JSON request body.', {
                status: 400,
            });
        }
        const instruction = body.continuum?.instruction?.trim() ||
            extractLatestUserInstruction(body.messages);
        if (!instruction) {
            return new Response('Add an instruction before sending a Continuum Vercel AI SDK request.', {
                status: 400,
            });
        }
        let adapter;
        try {
            adapter = await resolveRouteAdapter(options, request, body);
        }
        catch (error) {
            return new Response(normalizeError(error).message, {
                status: 400,
                headers: {
                    'content-type': 'text/plain; charset=utf-8',
                },
            });
        }
        const stream = createContinuumUiMessageStream({
            adapter,
            instruction,
            context: {
                currentView: body.currentView ?? undefined,
                currentData: body.currentData ?? undefined,
            },
            mode: body.continuum?.mode ?? options.defaultMode,
            addons: body.continuum?.addons,
            outputContract: body.continuum?.outputContract,
            authoringFormat: body.continuum?.authoringFormat ??
                options.defaultAuthoringFormat ??
                'line-dsl',
            autoApplyView: body.continuum?.autoApplyView,
            viewStreamMode: options.defaultViewStreamMode,
        });
        return createUIMessageStreamResponse({
            stream,
        });
    };
}
