import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BI_DIMENSIONS, BI_METRICS, BI_TIME_GRANULARITIES } from '../../config/bi-catalog.config';
import type { BIQueryInput } from '../../schemas/bi-query.schema';
import { BIExpressionService } from './bi-expression.service';

export class BIQueryService {
  private expressionService = new BIExpressionService();

  public async executeQuery(tenantId: string, input: BIQueryInput) {
    // 1. Extrair aliases de métricas agregadas declaradas
    const metricAliases = input.metrics.map((m) => m.alias);

    // 2. Validar todas as fórmulas de campos calculados customizados
    for (const cf of input.customFields) {
      this.expressionService.validateFormula(cf.formula, metricAliases);
    }

    // 3. Montar cláusulas WHERE seguras
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`"tenantId" = ${tenantId}`
    ];

    if (input.startDate) {
      const startIso = new Date(input.startDate).toISOString();
      whereConditions.push(Prisma.sql`"createdAt" >= ${startIso}::timestamp`);
    }

    if (input.endDate) {
      const endIso = new Date(input.endDate).toISOString();
      whereConditions.push(Prisma.sql`"createdAt" <= ${endIso}::timestamp`);
    }

    // Processar filtros dinâmicos whitelisted
    for (const filter of input.filters) {
      const fieldKey = filter.field;
      const val = filter.value;

      let columnSql: Prisma.Sql;
      if (fieldKey.startsWith('tags.')) {
        const tagKey = fieldKey.replace('tags.', '');
        columnSql = Prisma.sql`"tags"->>${tagKey}`;
      } else {
        const dimConfig = BI_DIMENSIONS[fieldKey];
        const metConfig = BI_METRICS[fieldKey];
        const dbField = dimConfig ? dimConfig.dbField : metConfig?.dbField;
        if (!dbField) continue;
        columnSql = Prisma.sql`"${Prisma.raw(dbField)}"`;
      }

      switch (filter.operator) {
        case 'EQUALS':
          whereConditions.push(Prisma.sql`${columnSql} = ${val as any}`);
          break;
        case 'NOT_EQUALS':
          whereConditions.push(Prisma.sql`${columnSql} != ${val as any}`);
          break;
        case 'IN':
          if (Array.isArray(val) && val.length > 0) {
            whereConditions.push(Prisma.sql`${columnSql} IN (${Prisma.join(val.map(v => Prisma.sql`${v}`))})`);
          }
          break;
        case 'NOT_IN':
          if (Array.isArray(val) && val.length > 0) {
            whereConditions.push(Prisma.sql`${columnSql} NOT IN (${Prisma.join(val.map(v => Prisma.sql`${v}`))})`);
          }
          break;
        case 'GREATER_THAN':
          whereConditions.push(Prisma.sql`${columnSql} > ${val as any}`);
          break;
        case 'GREATER_THAN_OR_EQUAL':
          whereConditions.push(Prisma.sql`${columnSql} >= ${val as any}`);
          break;
        case 'LESS_THAN':
          whereConditions.push(Prisma.sql`${columnSql} < ${val as any}`);
          break;
        case 'LESS_THAN_OR_EQUAL':
          whereConditions.push(Prisma.sql`${columnSql} <= ${val as any}`);
          break;
        case 'CONTAINS':
          whereConditions.push(Prisma.sql`${columnSql} ILIKE ${`%${val}%`}`);
          break;
      }
    }

    const whereClause = whereConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
      : Prisma.sql``;

    // 4. Montar Select e GroupBy
    const selectItems: Prisma.Sql[] = [];
    const groupByItems: Prisma.Sql[] = [];

    // Dimensão Temporal (Time Bucket)
    if (input.timeBucket && input.timeBucket !== 'none') {
      const granularity = BI_TIME_GRANULARITIES[input.timeBucket];
      if (granularity) {
        const timeTruncSql = Prisma.sql`DATE_TRUNC(${Prisma.raw(`'${granularity.sqlTrunc}'`)}, ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))`;
        selectItems.push(Prisma.sql`${timeTruncSql} AS "time_bucket"`);
        groupByItems.push(timeTruncSql);
      }
    }

    // Dimensões Padrão ou Tags
    for (const dimKey of input.dimensions) {
      if (dimKey.startsWith('tags.')) {
        const tagKey = dimKey.replace('tags.', '');
        const tagSql = Prisma.sql`"tags"->>${tagKey}`;
        selectItems.push(Prisma.sql`${tagSql} AS "${Prisma.raw(dimKey)}"`);
        groupByItems.push(tagSql);
      } else {
        const dimConfig = BI_DIMENSIONS[dimKey];
        if (dimConfig) {
          const colSql = Prisma.sql`"${Prisma.raw(dimConfig.dbField)}"`;
          selectItems.push(Prisma.sql`${colSql} AS "${Prisma.raw(dimKey)}"`);
          groupByItems.push(colSql);
        }
      }
    }

    // Métricas Agregadas
    for (const m of input.metrics) {
      const metricConfig = BI_METRICS[m.field];
      if (!metricConfig) continue;

      const aggFunc = m.aggregation;
      const alias = m.alias;

      let metricSql: Prisma.Sql;
      if (aggFunc === 'COUNT') {
        metricSql = Prisma.sql`COUNT(*)::INT AS "${Prisma.raw(alias)}"`;
      } else {
        const dbField = metricConfig.dbField;
        metricSql = Prisma.sql`COALESCE(${Prisma.raw(aggFunc)}("${Prisma.raw(dbField)}"), 0) AS "${Prisma.raw(alias)}"`;
      }
      selectItems.push(metricSql);
    }

    if (selectItems.length === 0) {
      selectItems.push(Prisma.sql`COUNT(*)::INT AS "requestCount"`);
    }

    const selectClause = Prisma.join(selectItems, ', ');
    const groupByClause = groupByItems.length > 0
      ? Prisma.sql`GROUP BY ${Prisma.join(groupByItems, ', ')}`
      : Prisma.sql``;

    // Order By
    let orderByClause = Prisma.sql``;
    if (input.orderBy) {
      const orderField = input.orderBy.field;
      const direction = input.orderBy.direction.toUpperCase() === 'ASC' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
      
      // Checar se orderField é um dos aliases de métrica ou dimensões
      if (metricAliases.includes(orderField) || input.dimensions.includes(orderField) || orderField === 'time_bucket') {
        orderByClause = Prisma.sql`ORDER BY "${Prisma.raw(orderField)}" ${direction}`;
      }
    }

    // Limit
    const limitClause = Prisma.sql`LIMIT ${input.limit}`;

    // Montar SQL final parametrizado
    const query = Prisma.sql`
      SELECT ${selectClause}
      FROM "usage_logs"
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      ${limitClause}
    `;

    const rawRows = await prisma.$queryRaw<Record<string, any>[]>(query);

    // 5. Formatar resultados e calcular campos customizados linha por linha
    const formattedRows = rawRows.map((row) => {
      const formattedRow: Record<string, any> = {};

      // Copiar dimensões e métricas
      for (const [key, val] of Object.entries(row)) {
        if (val instanceof Date) {
          formattedRow[key] = val.toISOString();
        } else if (typeof val === 'bigint') {
          formattedRow[key] = Number(val);
        } else {
          formattedRow[key] = val;
        }
      }

      // Avaliar campos calculados
      const metricValues: Record<string, number> = {};
      for (const alias of metricAliases) {
        metricValues[alias] = Number(formattedRow[alias] ?? 0);
      }

      for (const cf of input.customFields) {
        const computedVal = this.expressionService.evaluate(cf.formula, metricValues);
        formattedRow[cf.name] = Number(computedVal.toFixed(4));
      }

      return formattedRow;
    });

    return {
      totalRows: formattedRows.length,
      rows: formattedRows,
      appliedQuery: {
        dimensions: input.dimensions,
        metrics: input.metrics,
        customFields: input.customFields,
        timeBucket: input.timeBucket,
        limit: input.limit,
      },
    };
  }
}
