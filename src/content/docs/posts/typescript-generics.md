---
title: TypeScript 泛型入门
description: 理解 TypeScript 泛型的基本概念和使用场景
date: 2026-05-10
tags: [typescript, frontend]
---

## 什么是泛型

泛型让你在定义函数、接口或类时不预先指定具体类型，而是在使用时再指定。

```typescript
// 没有泛型：只能处理 number
function identity(arg: number): number {
  return arg;
}

// 使用泛型：可以处理任意类型
function identity<T>(arg: T): T {
  return arg;
}

// 使用
const num = identity<number>(42);   // number
const str = identity<string>('hi'); // string
// 类型推断也能工作
const inferred = identity(42);      // number
```

## 泛型约束

用 `extends` 给泛型加上约束，限制可以传入的类型：

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(arg: T): T {
  console.log(arg.length);
  return arg;
}

logLength('hello');     // OK: string has length
logLength([1, 2, 3]);   // OK: array has length
// logLength(42);        // Error: number has no length
```

## 泛型在 React 中的使用

```typescript
// 泛型组件 props
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// 使用
<List
  items={[{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]}
  renderItem={(user) => user.name}
/>
```

## 实用泛型工具类型

TypeScript 内置了很多实用的泛型工具：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Partial: 所有属性变为可选
type PartialUser = Partial<User>;

// Pick: 挑选部分属性
type UserPreview = Pick<User, 'id' | 'name'>;

// Omit: 排除部分属性
type UserWithoutEmail = Omit<User, 'email'>;

// Record: 构造对象类型
type UserMap = Record<string, User>;
```

泛型刚开始可能觉得抽象，但在写可复用的代码时非常有用。
