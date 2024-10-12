import {Context, Schema} from 'koishi'

// dr*
import {AIMessageChunk, BaseMessage} from '@langchain/core/messages'
import {ChatLunaPlugin} from 'koishi-plugin-chatluna/services/chat'
import {ChatGeneration, ChatGenerationChunk} from '@langchain/core/outputs'
import {ClientConfig} from "koishi-plugin-chatluna/llm-core/platform/config";
import {PlatformModelClient} from 'koishi-plugin-chatluna/llm-core/platform/client'
import {ModelRequester, ModelRequestParams} from "koishi-plugin-chatluna/llm-core/platform/api";
import {ModelInfo, ModelType} from "koishi-plugin-chatluna/llm-core/platform/types";
import {ChatLunaChatModel} from "koishi-plugin-chatluna/llm-core/platform/model";
import {ChatLunaError, ChatLunaErrorCode} from "koishi-plugin-chatluna/utils/error";

export const name = 'chatluna-cohere-playground-adapter'
export const usage = `## 使用

1. 获取 API Key：

- 登录 [Cohere](https://dashboard.cohere.com/)。
- 前往 [Cohere API Key](https://dashboard.cohere.com/api-keys) 页面，复制 \`Trial key\`。
  - \`Trial key\` 形如 \`iD35z8XuYzI1KKGoQ9EdzOSoV0SKPWLCHrUv61OD\`。

## 注意事项

- 国内需要科学上网环境。
- \`Cohere\` 每个账号有 \`1000 次/月\` 免费请求，超出后将无法使用。
  - 可使用 [Gmail 临时邮箱](https://www.emailtick.com/) 注册 Cohere 账号，以获取更多免费次数。
`
export const inject = {
  required: ['chatluna'],
}

// pz*
export interface Config extends ChatLunaPlugin.Config {
  apiKeys: string[];
  temperature: number;
  k: number;
  p: number;
  frequencyPenalty: number;
  presencePenalty: number;
  documents: Document[];
  safetyMode: string; // CONTEXTUAL, STRICT, NONE
}

export const Config: Schema<Config> = Schema.intersect([
  ChatLunaPlugin.Config,
  Schema.object({
    apiKeys: Schema.array(
      Schema.string().role('secret').required()
    ).description('Cohere API Keys。'),
  }).description('请求设置'),
  Schema.object({
    k: Schema.number().max(500).min(0).default(0).description('k 参数。确保在每个步骤中只考虑最有可能的 k 个 tokens。默认 0，范围 0-500。'),
    p: Schema.number().max(0.99).min(0.01).default(0.75).description('p 参数。确保在每一步生成时，只考虑总概率质量为 p 的可能性最大的 tokens。如果 k 和 p 都启用，则 p 在 k 之后执行。默认 0.75。范围 0.01-0.99。 '),
    temperature: Schema.number().max(1).min(0).step(0.1).default(1).description('回复温度，越高越随机。随机性可以通过增加 p 参数的值来进一步最大化。范围 0-1。'),
    frequencyPenalty: Schema.number().max(1).min(0).step(0.1).default(0).description('频率惩罚。用于减少生成的重复性。值越高，越随机，且跟 tokens 重复出现的次数成比例。默认 0，范围 0-1。'),
    presencePenalty: Schema.number().max(1).min(0).step(0.1).default(0).description('存在惩罚。用于减少生成的重复性。与频率惩罚类似，但这种惩罚适用于所有已经出现的 tokens，无论它们的频率（出现次数）如何。默认 0，范围 0-1。'),
    safetyMode: Schema.union(['CONTEXTUAL', 'STRICT', 'NONE']).default('NONE').description('安全模式。安全模式暂时不能与文档列表一起配置。'),
    documents: Schema.array(Schema.object({
      title: Schema.string(),
      text: Schema.string(),
    })).role('table').description(`文档列表。一个模型可以引用的相关文档列表，以生成更准确的回复。每个文档都是一个字符串-字符串字典。示例：
\`[
  {“title”：“高企鹅”，“text”：“帝企鹅最高。" },
  {“title”：“企鹅栖息地”，“text”：“帝企鹅只生活在南极洲。" },
]\` `),
  }).description('模型设置')
]) as any


// jk*
interface Result {
  chat_history: { role: string; message: string }[];
  preamble: string;
}

interface GetKeyResponse {
  rawKey: string;
}

interface Document {
  title: string;
  text: string;
}

interface ChatRequest {
  message: string;
  stream: boolean;
  chat_history?: any[];
  model?: string;
  preamble?: string;
  connectors?: any[];
  prompt_truncation?: string;

  max_tokens?: number;

  k?: number;
  p?: number;
  temperature?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  safety_mode?: string;
  documents?: Document[];
}

// zhs*
export async function apply(ctx: Context, config: Config) {
  // cl*
  const logger = ctx.logger('chatluna-cohere-playground-adapter')
  const platform = 'cohere'
  const plugin = new ChatLunaPlugin(ctx, config, platform)

  // l*
  class CohereRequester extends ModelRequester {
    constructor(
      private ctx: Context,
      private _config: ClientConfig,
      private _plugin: ChatLunaPlugin
    ) {
      super()
    }

    async* completionStream(
      params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {

      const result = await this.completion(params)

      yield new ChatGenerationChunk({
        text: result.text,
        message: new AIMessageChunk({
          content: result.message.content,
          name: result.message.name,
          additional_kwargs: result.message.additional_kwargs
        }),
        generationInfo: result.generationInfo
      })
    }

    async completion(params: ModelRequestParams): Promise<ChatGeneration> {
      const currentInput = params.input[params.input.length - 1]

      if (currentInput._getType() !== 'human') {
        throw new ChatLunaError(
          ChatLunaErrorCode.API_REQUEST_FAILED,
          new Error('CohereRequester only support human input')
        )
      }

      const text = await this._completion(params)

      return {
        text,
        message: new AIMessageChunk({
          content: text
        })
      }
    }

    private async _completion(params: ModelRequestParams) {
      try {
        // const apiKey = await getApiKey(this._config.apiKey);
        const chatResponse = await this.chat(this._config.apiKey, params.model, params.input as BaseMessage[]);

        const results: string[] = [chatResponse]

        return results.join('\n')
      } catch (error) {
        logger.error('An error occurred:', error);
      }
    }

    async chat(apiKey: string, model: string, messages: BaseMessage[]): Promise<string> {
      const message = messages[messages.length - 1].content as string;
      const {preamble, chat_history} = processMessages(messages);
      const bodyJson: ChatRequest = {
        message: message,
        chat_history: chat_history,
        model: model,
        preamble: preamble,
        connectors: [],
        stream: false,
        prompt_truncation: "OFF",

        temperature: config.temperature,
        k: config.k,
        p: config.p,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        documents: config.documents || [],
      };

      if (model === 'command-r-plus-08-2024' || model === 'command-r-08-2024') {
        bodyJson.safety_mode = config.safetyMode
      }

      const response = await this._plugin.fetch("https://api.cohere.com/v1/chat", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(bodyJson),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      const data: any = await response.json();
      return data.text;
    }

    dispose(): Promise<void> {
      return Promise.resolve(undefined);
    }

    init(): Promise<void> {
      return Promise.resolve(undefined);
    }
  }

  class CohereClient extends PlatformModelClient {
    platform = platform

    private _requester: CohereRequester

    private _models: {}

    constructor(
      ctx: Context,
      private _config: Config,
      clientConfig: ClientConfig,
      public plugin: ChatLunaPlugin
    ) {
      super(ctx, clientConfig)

      this._requester = new CohereRequester(ctx, clientConfig, plugin)
    }

    async init(): Promise<void> {
      if (this._models) {
        return
      }
      await this._requester.init()

      await this.getModels()
    }

    async getModels(): Promise<ModelInfo[]> {
      if (this._models) {
        return Object.values(this._models)
      }

      const models = await this.refreshModels()

      this._models = {}

      for (const model of models) {
        this._models[model.name] = model
      }

      return models
    }

    async refreshModels(): Promise<ModelInfo[]> {
      return ['command-r-plus-08-2024', 'command-r-04-2024', 'command-r-plus', 'command-r-08-2024', 'command-r-03-2024', 'command-r', 'command', 'command-nightly', 'command-light', 'command-light-nightly'].map((model) => {
        return {
          name: model,
          type: ModelType.llm,
          maxTokens: 128000,
          supportChatMode: (mode: string) => {
            return mode === 'chat'
          }
        }
      })
    }

    protected _createModel(model: string): ChatLunaChatModel {
      return new ChatLunaChatModel({
        requester: this._requester,
        model,
        modelMaxContextSize: 128000,
        timeout: this._config.timeout,
        maxRetries: this._config.maxRetries,
        llmType: 'cohere',
        modelInfo: this._models[model]
      })
    }
  }

  // sj*
  ctx.on('ready', async () => {
    await plugin.registerToService()

    await plugin.parseConfig((config) => {
      return config.apiKeys.map((apiKey) => {
        return {
          apiKey,
          platform,
          chatLimit: config.chatTimeLimit,
          timeout: config.timeout,
          maxRetries: config.maxRetries,
          concurrentMaxSize: config.chatConcurrentMaxSize
        }
      })
    })

    await plugin.registerClient(
      (_, clientConfig) =>
        new CohereClient(ctx, config, clientConfig, plugin)
    )

    await plugin.initClients()
  })

  // hs*
  async function getApiKey(authorizationForGetKey: string): Promise<string> {
    if (!authorizationForGetKey) {
      throw new Error('Authorization token is not set in environment variables');
    }

    const response = await fetch("https://production.api.os.cohere.com/rpc/BlobheartAPI/GetOrCreateDefaultAPIKey", {
      method: "POST",
      headers: {
        "authorization": authorizationForGetKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to get API key: ${response.statusText}`);
    }

    const data: GetKeyResponse = await response.json();
    return data.rawKey;
  }

  function processMessages(messages: BaseMessage[]): Result {
    let lastHumanIndex = messages.length - 1;
    while (lastHumanIndex >= 0 && messages[lastHumanIndex]._getType() !== 'human') {
      lastHumanIndex--;
    }
    if (lastHumanIndex >= 0) {
      messages.splice(lastHumanIndex, 1);
    }

    let preamble = '';
    const nonSystemMessages = messages.filter(message => {
      if (message._getType() === 'system') {
        preamble += message.content + ' ';
        return false;
      }
      return true;
    });

    const chat_history = nonSystemMessages.map(message => ({
      role: message._getType() === 'human' ? 'USER' : 'CHATBOT',
      message: message.content as string
    }));

    return {
      chat_history,
      preamble: preamble.trim()
    };
  }


}
