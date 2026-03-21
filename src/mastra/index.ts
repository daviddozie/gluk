import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { glukAgent } from './agents/gluk-agent';
import { researchWorkflow } from './workflows/research-workflow';

export const mastra = new Mastra({
  agents: { glukAgent },
  workflows: { researchWorkflow },
  storage: new LibSQLStore({
    id: "gluk-memory",
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  logger: new PinoLogger({
    name: 'Gluk',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'gluk',
        exporters: [
          new DefaultExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
});