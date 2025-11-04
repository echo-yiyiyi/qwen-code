import OpenAI from 'openai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from '../constants.js';
import type { OpenAICompatibleProvider } from './types.js';

/**
 * Default provider for standard OpenAI-compatible APIs
 */
export class DefaultOpenAICompatibleProvider
  implements OpenAICompatibleProvider
{
  protected contentGeneratorConfig: ContentGeneratorConfig;
  protected cliConfig: Config;

  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    this.cliConfig = cliConfig;
    this.contentGeneratorConfig = contentGeneratorConfig;
  }

  buildHeaders(): Record<string, string | undefined> {
    const version = this.cliConfig.getCliVersion() || 'unknown';
    const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;
    return {
      'User-Agent': userAgent,
    };
  }

  buildClient(): OpenAI {
    const {
      apiKey,
      baseUrl,
      timeout = DEFAULT_TIMEOUT,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = this.contentGeneratorConfig;
    const defaultHeaders = this.buildHeaders();

    // Azure OpenAI 兼容：
    // - 需要在查询参数中附加 api-version
    // - 建议 baseURL 指向 /openai/deployments/{deployment}
    // - 认证使用 'api-key' 头
    const isAzure = typeof baseUrl === 'string' && baseUrl.includes('.azure.com');
    const apiVersion = process.env['OPENAI_API_VERSION'];

    let effectiveBaseURL = baseUrl || '';
    if (isAzure) {
      // 规范化 baseURL，若未包含 deployments 路径则补齐
      const hasDeploymentsPath = /\/openai\/deployments\//.test(effectiveBaseURL);
      if (!hasDeploymentsPath) {
        const trimmed = effectiveBaseURL.replace(/\/$/, '');
        const deployment = this.contentGeneratorConfig.model || '';
        effectiveBaseURL = `${trimmed}/openai/deployments/${deployment}`;
      }
    }

    // 组合默认请求头（为 Azure 增加 api-key）
    const headers: Record<string, string | undefined> = {
      ...defaultHeaders,
      ...(isAzure ? { 'api-key': apiKey } : {}),
    };

    // 组合默认查询参数（为 Azure 增加 api-version）
    const defaultQuery: Record<string, string> | undefined =
      isAzure && apiVersion ? { 'api-version': apiVersion } : undefined;

    return new OpenAI({
      apiKey, // 对 Azure 来说同时保留不会影响，主要以 'api-key' 生效
      baseURL: effectiveBaseURL || undefined,
      timeout,
      maxRetries,
      defaultHeaders: headers,
      ...(defaultQuery ? { defaultQuery } : {}),
    });
  }

  buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    _userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    // Default provider doesn't need special enhancements, just pass through all parameters
    return {
      ...request, // Preserve all original parameters including sampling params
    };
  }
}
