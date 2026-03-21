function openAiReasoningModelId(modelId) {
    if (!modelId) {
        return false;
    }
    if (/^o[0-9]/.test(modelId)) {
        return true;
    }
    if (modelId.includes('gpt-5')) {
        return true;
    }
    return false;
}
function readLanguageModelProviderAndId(model) {
    if (typeof model === 'string') {
        const slash = model.indexOf('/');
        if (slash <= 0) {
            return {};
        }
        return {
            provider: model.slice(0, slash),
            modelId: model.slice(slash + 1),
        };
    }
    if (typeof model !== 'object' || model === null) {
        return {};
    }
    const record = model;
    const provider = record.provider;
    const modelId = record.modelId;
    return {
        provider: typeof provider === 'string' ? provider : undefined,
        modelId: typeof modelId === 'string' ? modelId : undefined,
    };
}
export function resolveTemperatureForLanguageModel(model, temperature) {
    if (temperature === undefined) {
        return undefined;
    }
    const { provider, modelId } = readLanguageModelProviderAndId(model);
    if (!provider || !provider.includes('openai')) {
        return temperature;
    }
    const id = modelId ? modelId.toLowerCase() : '';
    if (openAiReasoningModelId(id)) {
        return undefined;
    }
    return temperature;
}
