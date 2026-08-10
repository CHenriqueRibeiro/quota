import { z } from 'zod';
import { BI_DIMENSIONS, BI_METRICS, BI_TIME_GRANULARITIES } from '../config/bi-catalog.config';

const filterOperatorEnum = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'CONTAINS',
]);

const aggregationFunctionEnum = z.enum(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT']);

export const biFilterSchema = z.object({
  field: z.string().refine((val) => {
    return val.startsWith('tags.') || Boolean(BI_DIMENSIONS[val]) || Boolean(BI_METRICS[val]);
  }, { message: 'Campo inválido para filtragem. Deve pertencer ao Catálogo de Dados.' }),
  operator: filterOperatorEnum,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
  ]),
});

export const biMetricAggregationSchema = z.object({
  field: z.string().refine((val) => Boolean(BI_METRICS[val]), {
    message: 'Métrica inválida. Deve pertencer ao catálogo de métricas.',
  }),
  aggregation: aggregationFunctionEnum,
  alias: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Alias deve conter apenas letras, números e underscores.',
  }),
}).refine((data) => {
  const metric = BI_METRICS[data.field];
  if (!metric) return false;
  return metric.allowedAggregations.includes(data.aggregation);
}, {
  message: 'Função de agregação não permitida para esta métrica.',
});

export const biCustomFieldSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Nome do campo customizado deve conter apenas caracteres alfanuméricos e underscore.',
  }),
  label: z.string().min(1).max(100).optional(),
  formula: z.string().min(1).max(250),
});

export const biQuerySchema = z.object({
  startDate: z.string().datetime({ message: 'startDate deve ser uma data ISO-8601 válida.' }).optional(),
  endDate: z.string().datetime({ message: 'endDate deve ser uma data ISO-8601 válida.' }).optional(),
  timeBucket: z.enum(['hour', 'day', 'week', 'month', 'none']).default('none'),
  dimensions: z.array(
    z.string().refine((val) => val.startsWith('tags.') || Boolean(BI_DIMENSIONS[val]), {
      message: 'Dimensão de agrupamento inválida. Deve pertencer ao Catálogo de Dados.',
    })
  ).default([]),
  metrics: z.array(biMetricAggregationSchema).min(1, {
    message: 'Selecione ao menos 1 métrica agregada para consulta.',
  }),
  customFields: z.array(biCustomFieldSchema).default([]),
  filters: z.array(biFilterSchema).default([]),
  orderBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
}).refine((data) => {
  // Garantir que dimensões selecionadas permitam groupBy
  for (const dimKey of data.dimensions) {
    if (dimKey.startsWith('tags.')) continue;
    const dim = BI_DIMENSIONS[dimKey];
    if (dim && !dim.allowGroupBy) {
      return false;
    }
  }
  return true;
}, {
  message: 'Uma ou mais dimensões selecionadas não permitem agrupamento (group-by).',
});

export type BIQueryInput = z.infer<typeof biQuerySchema>;
export type BIFilterInput = z.infer<typeof biFilterSchema>;
export type BIMetricAggregationInput = z.infer<typeof biMetricAggregationSchema>;
export type BICustomFieldInput = z.infer<typeof biCustomFieldSchema>;
