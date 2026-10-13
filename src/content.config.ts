import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        date: z.date().optional(),
        tags: z
          .array(z.string())
          .optional()
          .default([])
          // 统一小写 + 去空格，避免 ai/AI、agent/Agent、mcp/MCP 等变体
          // 在大小写不敏感文件系统上归并到同一路由目录导致文章丢失。
          .transform((t) => t.map((s) => s.trim().toLowerCase())),
      }),
    }),
  }),
};
