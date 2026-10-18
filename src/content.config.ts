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
        // 标签统一规范化：
        //  - 去首尾空白 + 转小写，避免 `ai`/`AI`、`mcp`/`MCP` 这类大小写变体
        //    各自生成标签页并在大小写不敏感文件系统上互相覆盖；
        //  - 空白折叠为连字符，避免 `/tags/ai%20agent/` 这种带空格的 URL。
        tags: z
          .array(z.string())
          .optional()
          .default([])
          .transform((tags) =>
            tags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, '-')),
          ),
      }),
    }),
  }),
};
