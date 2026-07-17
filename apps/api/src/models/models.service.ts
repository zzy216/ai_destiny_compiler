import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import {
  ModelConfig,
  ModelConfigVersion,
  ModelCredential,
} from '../database/entities';
import {
  ModelAdapterError,
  OllamaModelAdapter,
  OpenAiCompatibleModelAdapter,
  type ModelAdapterConfig,
  type ModelConnectionResult,
} from './model-adapters';
import { ModelCredentialCipher } from './model-credential-cipher';
import { contractNotImplemented } from '../common/contract-not-implemented';

@Injectable()
export class ModelsService {
  constructor(
    @Optional()
    @InjectRepository(ModelConfig)
    private readonly modelConfigs?: Repository<ModelConfig>,
    @Optional()
    @InjectRepository(ModelConfigVersion)
    private readonly modelVersions?: Repository<ModelConfigVersion>,
    @Optional()
    @InjectRepository(ModelCredential)
    private readonly modelCredentials?: Repository<ModelCredential>,
    @Optional()
    private readonly credentialCipher?: ModelCredentialCipher,
  ) {}

  async testConnection(modelConfigId: string): Promise<ModelConnectionResult> {
    if (!this.modelConfigs || !this.modelVersions) {
      return contractNotImplemented();
    }

    const modelConfig = await this.modelConfigs.findOne({
      where: { id: modelConfigId },
    });
    if (!modelConfig) {
      throw new NotFoundException('Model not found');
    }

    const versionId = modelConfig.currentDraftVersionId ?? modelConfig.publishedVersionId;
    if (!versionId) {
      throw new BadRequestException('Model has no testable version');
    }

    const version = await this.modelVersions.findOne({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException('Model version not found');
    }

    const adapter = this.createAdapter(modelConfig.protocol);
    let apiKey: string | undefined;
    if (this.modelCredentials) {
      const credential = await this.modelCredentials.findOne({
        where: { modelConfigId },
      });
      if (credential) {
        if (!this.credentialCipher) {
          throw new InternalServerErrorException('Model credential is unavailable');
        }
        try {
          apiKey = this.credentialCipher.decrypt(credential);
        } catch {
          throw new InternalServerErrorException('Model credential is unavailable');
        }
      }
    }

    const config: ModelAdapterConfig = {
      baseUrl: version.baseUrl,
      modelName: version.modelName,
      apiKey,
      timeoutMs: version.timeoutMs,
      maxOutputTokens: version.maxOutputTokens,
    };

    try {
      return await adapter.testConnection(config);
    } catch (error) {
      if (error instanceof ModelAdapterError) {
        return {
          reachable: false,
          latencyMs: 0,
          errorCode: error.code,
          errorMessage: error.message,
        };
      }
      return {
        reachable: false,
        latencyMs: 0,
        errorCode: 'provider_unreachable',
        errorMessage: 'Model provider is unreachable',
      };
    }
  }

  private createAdapter(protocol: string): OpenAiCompatibleModelAdapter | OllamaModelAdapter {
    switch (protocol) {
      case 'openai_compatible':
        return new OpenAiCompatibleModelAdapter();
      case 'ollama':
        return new OllamaModelAdapter();
      default:
        throw new BadRequestException('Model protocol is not supported for connection tests');
    }
  }
}
