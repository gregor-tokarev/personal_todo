import { defineStore } from "pinia";
import { Task, taskStore } from "@models/task.model.ts";
import { useDraftsStore } from "./drafts.ts";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { Draft } from "@models/draft.model.ts";
import { IntegrationTask } from "@models/integration.model.ts";
import { idbContextManager, trpc } from "../main.ts";

export const useTaskStore = defineStore("task", {
  state: () => ({
    tasks: [] as Task[],
  }),
  actions: {
    async loadTasks() {
      this.tasks = (await idbContextManager.getItems(taskStore)) as Task[];
    },

    async backwardSync() {
      const tasks = await trpc.task.getAll.query();

      await idbContextManager.backwardSync(taskStore, tasks);
      this.tasks = await idbContextManager.getItems(taskStore);
    },
    commitDraft(
      draftId: string,
      dateTodo: string,
      newIdx: number,
    ): Task | undefined {
      const draftStore = useDraftsStore();

      const draft = draftStore.getOne(draftId);
      if (!draft) return;

      const task: Task = {
        id: nanoid(3),
        draftId: draft.id,
        title: draft.title,
        status: "todo",
        dateUpdated: draft.dateUpdated,
        dateCreated: draft.dateCreated,
        dateCommitted: dayjs().toISOString(),
        dateCompleted: null,
        order: newIdx,
        dateTodo,
        projectId: draft.projectId,
      };

      idbContextManager.putItem(taskStore, task);

      this.tasks.push(task);
      this.setOrder(task.id, task.dateTodo, newIdx); // needed to change other tasks order

      draftStore.remove(draftId);
    },
    commitIntegration(draft: Draft, dateTodo: string, newIdx: number): Task {
      const task: Task = {
        id: nanoid(3),
        draftId: draft.id,
        title: draft.title,
        status: "todo",
        dateUpdated: draft.dateUpdated,
        dateCreated: draft.dateCreated,
        dateCommitted: dayjs().toISOString(),
        dateCompleted: null,
        order: newIdx,
        dateTodo,
        projectId: draft.projectId,
        external: JSON.parse(JSON.stringify(draft.external)),
      };

      idbContextManager.putItem(taskStore, task);

      this.tasks.push(task);
      this.setOrder(task.id, task.dateTodo, newIdx); // needed to change other tasks order

      return task;
    },
    setOrder(taskId: string, date: string, order: number): Task | undefined {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task) return;

      task.order = order;

      this.getByDate(date)
        .filter((t) => t.order >= order && t.id !== taskId)
        .forEach((t) => {
          idbContextManager.putItem(taskStore, { ...t, order: t.order + 1 });
          t.order++;
        });

      return task;
    },
    changeOrder(
      taskId: string,
      oldIdx: number,
      newIdx: number,
    ): Task | undefined {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task) return;

      const dateTasks = this.getByDate(task.dateTodo);

      if (oldIdx > newIdx) {
        const targetTasks = dateTasks.filter(
          (t) => t.order >= newIdx && t.order < oldIdx && t.id !== taskId,
        );
        targetTasks.forEach((t) => {
          idbContextManager.putItem(taskStore, { ...t, order: t.order + 1 });
          t.order++;
        });
      } else if (oldIdx < newIdx) {
        const targetTasks = dateTasks.filter(
          (t) => t.order <= newIdx && t.order > oldIdx && t.id !== taskId,
        );
        targetTasks.forEach((t) => {
          idbContextManager.putItem(taskStore, { ...t, order: t.order - 1 });
          t.order--;
        });
      }

      task.order = newIdx;
      idbContextManager.putItem(taskStore, task);

      return task;
    },
    changeTodoDate(
      taskId: string,
      newDate: string,
      newIdx: number,
    ): Task | undefined {
      const taskIdx = this.tasks.findIndex((t) => t.id === taskId);

      const oldDateTasks = this.tasks.filter((t) =>
        dayjs(t.dateTodo).isSame(this.tasks[taskIdx].dateTodo, "day"),
      );
      oldDateTasks
        .filter((t) => t.order > this.tasks[taskIdx].order)
        .forEach((t) => {
          idbContextManager.putItem(taskStore, { ...t, order: t.order - 1 });
          t.order--;
        });

      this.tasks[taskIdx].dateTodo = newDate;
      idbContextManager.putItem(taskStore, this.tasks[taskIdx]);

      this.setOrder(taskId, newDate, newIdx);

      return this.tasks[taskIdx];
    },
    update(taskId: string, newTask: Partial<Task>): void {
      const taskIdx = this.tasks.findIndex((t) => t.id === taskId);
      this.tasks.splice(taskIdx, 1, { ...this.tasks[taskIdx], ...newTask });

      idbContextManager.putItem(taskStore, this.tasks[taskIdx]);
    },
    updateFromIntegrations(draft: IntegrationTask[]): void {
      draft.forEach((d) => {
        const taskIdx = this.tasks.findIndex((t) => t.draftId === d.id);

        const task: Task = {
          id: nanoid(3),
          draftId: d.id,
          title: d.title,
          status: this.tasks[taskIdx].status,
          dateUpdated: d.updatedAt,
          dateCreated: d.createdAt,
          dateCommitted: dayjs().toISOString(),
          dateCompleted: null,
          order: this.tasks[taskIdx].order,
          dateTodo: this.tasks[taskIdx].dateTodo,
          projectId: null,
          external: {
            integrationName: d.integrationName,
            projectTitle: d.projectTitle,
            projectId: d.projectId,
            iconURL: d.iconURL,
            link: d.link,
          },
        };

        idbContextManager.putItem(taskStore, task);
        this.tasks.splice(taskIdx, 1, task);
      });
    },
    remove(taskId: string): void {
      idbContextManager.deleteItem(taskStore, taskId);

      const taskIdx = this.tasks.findIndex((t) => t.id === taskId);
      this.tasks.splice(taskIdx, 1);
    },
  },
  getters: {
    getByDate(state) {
      return (date: string): Task[] => {
        const searchedDate = dayjs(date);

        return state.tasks
          .filter((t) => {
            return dayjs(t.dateTodo).isSame(searchedDate, "day");
          })
          .sort((prev, next) => prev.order - next.order);
      };
    },
    getByProject(state) {
      return (projectId: string): Task[] => {
        return state.tasks.filter((t) => t.projectId === projectId);
      };
    },
    getOne(state) {
      return (taskId: string): Task | undefined => {
        return state.tasks.find((t) => t.id === taskId);
      };
    },
  },
});