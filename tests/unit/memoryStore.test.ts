import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@/server/repos/memoryStore';

describe('the memory store', () => {
  const store = () => createMemoryStore();
  interface Doc {
    n?: number | null;
    label?: string;
  }

  it('create returns false and changes nothing when the document exists', async () => {
    const s = store();
    expect(await s.create('c/1', { n: 1 })).toBe(true);
    expect(await s.create('c/1', { n: 2 })).toBe(false);
    expect(await s.get<Doc>('c/1')).toEqual({ n: 1 });
  });

  it('get returns null for a missing document and delete is idempotent', async () => {
    const s = store();
    expect(await s.get('c/missing')).toBeNull();
    await s.set('c/1', { n: 1 });
    await s.delete('c/1');
    await s.delete('c/1');
    expect(await s.get('c/1')).toBeNull();
  });

  it('update merges top-level fields and throws on a missing document', async () => {
    const s = store();
    await expect(s.update('c/missing', { n: 1 })).rejects.toThrow('No document at c/missing');
    await s.set('c/1', { n: 1, label: 'a' });
    await s.update('c/1', { n: 2 });
    expect(await s.get<Doc>('c/1')).toEqual({ n: 2, label: 'a' });
    expect(await s.get('c/missing')).toBeNull();
  });

  it('list filters, orders and limits', async () => {
    const s = store();
    for (const n of [5, 1, 4, 2, 3]) await s.set(`c/${n}`, { n, label: n % 2 ? 'odd' : 'even' });
    expect(
      (
        await s.list<Doc>('c', {
          where: [{ field: 'label', op: '==', value: 'even' }],
          orderBy: { field: 'n', direction: 'asc' },
        })
      ).map((d) => d.n),
    ).toEqual([2, 4]);
    expect((await s.list<Doc>('c', { orderBy: { field: 'n', direction: 'desc' }, limit: 2 })).map((d) => d.n)).toEqual([
      5, 4,
    ]);
    expect(
      (
        await s.list<Doc>('c', {
          where: [
            { field: 'n', op: '>', value: 2 },
            { field: 'n', op: '<', value: 5 },
          ],
          orderBy: { field: 'n', direction: 'asc' },
        })
      ).map((d) => d.n),
    ).toEqual([3, 4]);
    expect((await s.list<Doc>('c', { where: [{ field: 'n', op: '>=', value: 5 }] })).map((d) => d.n)).toEqual([5]);
    expect(await s.list<Doc>('c', { limit: 0 })).toEqual([]);
    expect(await s.list<Doc>('empty')).toEqual([]);
  });

  it('list only returns direct children of the collection', async () => {
    const s = store();
    await s.set('c/1', { n: 1 });
    await s.set('c/1/sub/2', { n: 2 });
    await s.set('cc/3', { n: 3 });
    expect((await s.list<Doc>('c')).map((d) => d.n)).toEqual([1]);
  });

  it('a <= filter never matches null, missing or differently typed fields', async () => {
    const s = store();
    await s.set('c/null', { n: null });
    await s.set('c/missing', { label: 'x' });
    await s.set('c/text', { n: '0' });
    await s.set('c/zero', { n: 0 });
    await s.set('c/high', { n: 100 });
    const found = await s.list<Doc>('c', { where: [{ field: 'n', op: '<=', value: 50 }] });
    expect(found).toEqual([{ n: 0 }]);
  });

  it('ordering leaves out documents without the field', async () => {
    const s = store();
    await s.set('c/a', { n: 2 });
    await s.set('c/b', { n: null });
    await s.set('c/c', { label: 'x' });
    expect((await s.list<Doc>('c', { orderBy: { field: 'n', direction: 'asc' } })).map((d) => d.n)).toEqual([2]);
  });

  it('listGroup works across parents and returns paths', async () => {
    const s = store();
    await s.set('circles/a/doses/1', { n: 3 });
    await s.set('circles/b/doses/2', { n: 1 });
    await s.set('circles/b/meds/3', { n: 2 });
    const found = await s.listGroup<Doc>('doses', { orderBy: { field: 'n', direction: 'asc' } });
    expect(found).toEqual([
      { path: 'circles/b/doses/2', data: { n: 1 } },
      { path: 'circles/a/doses/1', data: { n: 3 } },
    ]);
    expect(await s.listGroup<Doc>('doses', { where: [{ field: 'n', op: '<=', value: 1 }], limit: 5 })).toHaveLength(1);
  });

  it('a transaction applies all writes together', async () => {
    const s = store();
    await s.set('c/1', { n: 1 });
    const result = await s.transaction(async (tx) => {
      const current = await tx.get<Doc>('c/1');
      tx.update('c/1', { n: (current?.n ?? 0) + 1 });
      tx.set('c/2', { n: 9 });
      tx.delete('c/1');
      return 'done';
    });
    expect(result).toBe('done');
    expect(await s.get('c/1')).toBeNull();
    expect(await s.get<Doc>('c/2')).toEqual({ n: 9 });
  });

  it('a failed transaction writes nothing and does not block the next one', async () => {
    const s = store();
    await s.set('c/1', { n: 1 });
    await expect(
      s.transaction(async (tx) => {
        tx.set('c/1', { n: 99 });
        tx.set('c/2', { n: 2 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(
      s.transaction(async (tx) => {
        tx.set('c/3', { n: 3 });
        tx.update('c/missing', { n: 1 });
      }),
    ).rejects.toThrow('No document at c/missing');
    expect(await s.get<Doc>('c/1')).toEqual({ n: 1 });
    expect(await s.get('c/2')).toBeNull();
    // All or nothing, like Firestore: the write queued before the failing update is dropped too.
    expect(await s.get('c/3')).toBeNull();
    expect(await s.transaction(async () => 'still works')).toBe('still works');
  });

  it('transactions run one at a time, so concurrent increments are not lost', async () => {
    const s = store();
    await s.set('c/counter', { n: 0 });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        s.transaction(async (tx) => {
          const current = await tx.get<Doc>('c/counter');
          tx.set('c/counter', { n: (current?.n ?? 0) + 1 });
        }),
      ),
    );
    expect(await s.get<Doc>('c/counter')).toEqual({ n: 20 });
  });

  it('reads and writes copy, so callers cannot change stored data by mutating', async () => {
    const s = store();
    const original = { n: 1, nested: { list: [1] } };
    await s.set('c/1', original);
    original.nested.list.push(2);
    const first = await s.get<typeof original>('c/1');
    expect(first?.nested.list).toEqual([1]);
    first?.nested.list.push(3);
    expect((await s.get<typeof original>('c/1'))?.nested.list).toEqual([1]);
    (await s.list<typeof original>('c'))[0].nested.list.push(4);
    (await s.listGroup<typeof original>('c', {}))[0].data.nested.list.push(5);
    expect((await s.get<typeof original>('c/1'))?.nested.list).toEqual([1]);
  });
});
