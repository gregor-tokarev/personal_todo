import { IDBPDatabase, openDB } from "idb";
import { Table } from "./define-schema";
import { ColumnBase } from "./column-base";
import { StoreKey } from "idb/build/entry";
import {
  createSync,
  CreateSyncAction,
  DeleteSyncAction,
  SyncEntry,
  UpdateSyncAction,
} from "./sync-entry";

export const DB_NAME = "SYNC_DB";
export const SYNC_STORE_NAME = "SYNC_STORE";
export let DB: IDBPDatabase | null = null;

let SYNC_COUNT = 0;
let NETWORK_STATUS: "online" | "offline" = navigator.onLine
  ? "online"
  : "offline";

export interface OnSyncFn {
  (entries: SyncEntry, resolveFn: () => void): void;
}

export interface OnSyncStateFn {
  (state: typeof NETWORK_STATUS, syncCount: number): void;
}

export async function connect<
  M,
  R extends Record<string, ColumnBase<any>>,
  TSchema extends Table<M, R>[],
>(version: number, schema: TSchema) {
  DB = await openDB(DB_NAME, version, {
    upgrade(database, oldVersion, newVersion, transaction, _event) {
      if (oldVersion >= newVersion) return;

      if (!database.objectStoreNames.contains(SYNC_STORE_NAME))
        database.createObjectStore(SYNC_STORE_NAME, {
          keyPath: "id",
        });

      schema.forEach(async (sc) => {
        const indexColumns = Object.values(sc.dataSchema).filter(
          (column) => column.config.createIndex,
        );
        const primaryColumn = Object.values(sc.dataSchema).find(
          (column) => column.config.isPrimary,
        );

        if (!database.objectStoreNames.contains(sc.name)) {
          console.debug(`Not found table named: ${sc.name}`);
          console.debug(`Creating ${sc.name}...`);

          const store = database.createObjectStore(sc.name, {
            keyPath: primaryColumn.config.name,
          });

          indexColumns.forEach((column) => {
            store.createIndex(column.config.name, column.config.name);
          });
        } else {
          const store = transaction.objectStore(sc.name);
          const indexes = store.indexNames;

          Array.from(indexes).forEach((index) => {
            if (!indexColumns.map((c) => c.config.name).includes(index)) {
              console.log(`Deleting index ${index}...`);
              store.deleteIndex(index);
            }
          });

          indexColumns.forEach((c) => {
            if (!indexes.contains(c.config.name)) {
              console.log(`Creating index ${c.config.name}...`);
              store.createIndex(c.config.name, c.config.name);
            }
          });
        }
      });
    },
  });

  let onSyncCallback: OnSyncFn | null = null;
  function onSync(fn: OnSyncFn) {
    onSyncCallback = fn;
  }

  let onSyncStateCallback: OnSyncStateFn | null = null;
  function onSyncState(fn: OnSyncStateFn) {
    onSyncStateCallback = fn;
  }

  window.addEventListener("online", async () => {
    NETWORK_STATUS = "online";
    onSyncStateCallback(NETWORK_STATUS, SYNC_COUNT);

    const entries = await getSyncTargets();
    if (onSyncCallback) {
      entries.forEach((entry) => {
        NETWORK_STATUS === "online" &&
          onSyncCallback(entry, resolveSyncs(entry.action.id));
      });
    }
  });
  window.addEventListener("offline", () => {
    NETWORK_STATUS = "offline";
    onSyncStateCallback(NETWORK_STATUS, SYNC_COUNT);
  });

  function resolveSyncs(targetId: string | number) {
    return async () => {
      const allSyncs = (await DB.getAll(SYNC_STORE_NAME)) as SyncEntry[];
      const targetSyncs = allSyncs.filter((sy) => sy.action.id === targetId);

      const operations = targetSyncs.map((e) =>
        DB.delete(SYNC_STORE_NAME, e.id),
      );
      await Promise.all(operations);

      SYNC_COUNT -= 1;
      onSyncStateCallback(NETWORK_STATUS, SYNC_COUNT);
    };
  }

  async function mergeSyncEntries(
    targetId: string | number,
  ): Promise<SyncEntry> {
    const allSyncs = (await DB.getAll(SYNC_STORE_NAME)) as SyncEntry[];
    const targetSyncs = allSyncs
      .filter((sy) => sy.action.id === targetId)
      .sort((prev, next) => prev.timestamp - next.timestamp);

    const deleteEvent = targetSyncs.find(
      (se) => se.action.actionName === "delete",
    );
    if (deleteEvent) return deleteEvent;

    const creationEvent = targetSyncs.find(
      (se) => se.action.actionName === "create",
    );

    let finalData = creationEvent ? creationEvent.action["data"] : {};

    const updateEntries = targetSyncs.filter(
      (se) => se.action.actionName === "update",
    );

    updateEntries.forEach((se) => {
      finalData = Object.assign(finalData, se.action["data"]);
    });

    return creationEvent
      ? {
          ...creationEvent,
          // @ts-ignore
          action: { ...creationEvent.action, data: finalData },
        }
      : {
          ...updateEntries[updateEntries.length - 1],
          action: {
            ...updateEntries[updateEntries.length - 1].action,
            data: finalData,
          },
        };
  }

  async function getSyncTargets() {
    const allSyncs = (await DB.getAll(SYNC_STORE_NAME)) as SyncEntry[];
    const targetIds = allSyncs.map((sync) => sync.action.id);

    const entries = await Promise.all(
      targetIds.map((id) => mergeSyncEntries(id)),
    );

    return entries;
  }

  async function backwardSync<
    TColumn,
    TDataSchema extends Record<string, ColumnBase<TColumn>>,
    R extends Record<keyof TDataSchema, any>,
  >(table: Table<TColumn, TDataSchema>, records: R[]) {
    await DB.clear(table.name);

    return Promise.all(
      records.map((r) => {
        return DB.put(table.name, r);
      }),
    );
  }

  async function getItems<
    TColumn,
    TDataSchema extends Record<string, ColumnBase<TColumn>>,
  >(table: Table<TColumn, TDataSchema>) {
    return DB.getAll(table.name);
  }

  function putItem<
    TColumn,
    TDataSchema extends Record<string, ColumnBase<TColumn>>,
    R extends Record<keyof TDataSchema, any>,
  >(table: Table<TColumn, TDataSchema>, object: R): R {
    const defaultedObj = mapObjectToTable(table, object);

    (async () => {
      const res = await DB.get(table.name, defaultedObj["id"]);

      await DB.put(table.name, defaultedObj);

      const action = res
        ? new UpdateSyncAction(defaultedObj["id"], defaultedObj)
        : new CreateSyncAction(defaultedObj["id"], defaultedObj);
      await createSync(action, table);

      const syncEvent = await mergeSyncEntries(defaultedObj["id"]);
      onSyncCallback &&
        NETWORK_STATUS === "online" &&
        onSyncCallback({ ...syncEvent }, resolveSyncs(defaultedObj["id"]));

      SYNC_COUNT++;
      onSyncStateCallback(NETWORK_STATUS, SYNC_COUNT);
    })();

    return object;
  }

  function deleteItem<
    TColumn extends StoreKey<unknown, any> | IDBKeyRange,
    TDataSchema extends Record<string, ColumnBase<TColumn>>,
  >(
    table: Table<TColumn, TDataSchema>,
    key: string | number | string[] | number[],
  ) {
    (async () => {
      const iterable = Array.isArray(key) ? key : [key];

      for await (const k of iterable) {
        const exist = await DB.get(table.name, k);
        if (!exist) return;

        await DB.delete(table.name, k);

        const deleteAction = new DeleteSyncAction(k);
        await createSync(deleteAction, table);

        const syncEvent = await mergeSyncEntries(k);
        SYNC_COUNT++;
        onSyncCallback &&
          NETWORK_STATUS === "online" &&
          onSyncCallback(syncEvent, resolveSyncs(k));
      }
    })();
  }

  return {
    db: DB,
    putItem,
    getItems,
    deleteItem,
    onSyncState,
    onSync,
    backwardSync,
  };
}

function mapObjectToTable<
  TColumn extends ColumnBase<any>,
  TDataSchema extends Record<string, TColumn>,
  M extends Record<keyof TDataSchema, any>,
>(table: Table<any, TDataSchema>, object: M): M {
  const obj = {} as M;

  for (const objKey in table.dataSchema) {
    const column = Object.values(table.dataSchema).find(
      (c) => c.config.name === objKey,
    );

    const defaultValue =
      column.config.default ?? column.config.defaultFn
        ? column.config.defaultFn()
        : null;
    obj[objKey] = object[objKey] ?? defaultValue;
  }

  return obj;
}
