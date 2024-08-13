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
export const usage = `## 🌈 使用

1. **获取 authorization：**

- 访问 [Cohere Playground](https://dashboard.cohere.com/playground/chat) 并登录。
- 打开浏览器开发者工具 (F12)，切换到 "Network" (网络) 选项卡。
- 在 playground 中进行一次对话，找到名为 \`Session\` 的网络请求。
- 在请求头 (Request Headers) 中，复制 \`authorization\` 的值。
  - 格式类似: \`Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\`

2. **配置插件：** 在插件设置中填入获取到的 \`authorization\`。

3. **开始使用！** 现在您可以通过 Chatluna 与 Cohere AI 进行对话了。

- 仅推荐使用 \`command-r-plus\` 模型，其他模型不予置评。`
export const inject = {
  required: ['chatluna'],
}

// pz*
export interface Config extends ChatLunaPlugin.Config {
  authorizations: string[];
  temperature: number;
}

export const Config: Schema<Config> = Schema.intersect([
  ChatLunaPlugin.Config,
  Schema.object({
    authorizations: Schema.array(
      Schema.string().role('secret').required()
    ).description('Cohere 授权码。'),
    temperature: Schema.number().max(1).min(0).step(0.1).default(1).description('回复温度，越高越随机。'),
  }).description('请求设置')
]) as any


// jk*
interface Result {
  chat_history: { role: string; message: string }[];
  preamble: string;
}

interface GetKeyResponse {
  rawKey: string;
}

interface ChatRequest {
  message: string;
  temperature: number;
  chat_history: any[];
  model: string;
  preamble: string;
  connectors: any[];
  stream: boolean;
  prompt_truncation: string;
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
        const apiKey = await getApiKey(this._config.apiKey);
        const chatResponse = await this.chat(apiKey, params.model, params.input as BaseMessage[]);

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
        temperature: config.temperature,
        chat_history: chat_history,
        model: model,
        preamble: preamble,
        connectors: [],
        stream: false,
        prompt_truncation: "OFF"
      };

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
      return ['command-r-plus', 'command-r', 'command', 'command-nightly', 'command-light', 'command-light-nightly', 'c4ai-aya-23'].map((model) => {
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
      return config.authorizations.map((apiKey) => {
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
