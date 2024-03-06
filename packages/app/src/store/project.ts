import { defineStore } from "pinia";
import {
  Project,
  ProjectStatistic,
  projectTable,
} from "@models/project.model.ts";
import { randomInt } from "@utils/random.ts";
import { nanoid } from "nanoid";
import Fuse from "fuse.js";
import { useDraftsStore } from "./drafts.ts";
import minMax from "dayjs/plugin/minMax";
import dayjs from "dayjs";
import { useTaskStore } from "./task.ts";
import { idbContextManager } from "../main.ts";

dayjs.extend(minMax);

export const useProjectStore = defineStore("project", {
  state: () => ({
    projects: [] as Project[],
    colors: [
      "red",
      "orange",
      "amber",
      "yellow",
      "lime",
      "green",
      "emerald",
      "teal",
      "cyan",
      "sky",
      "blue",
      "indigo",
      "violet",
      "purple",
      "fuchsia",
      "pink",
      "rose",
    ],
  }),
  actions: {
    async loadProjects() {
      this.projects = await idbContextManager.getItems(projectTable);
    },
    create(title: string): Project {
      const proj: Project = {
        id: nanoid(4),
        color: this.colors[randomInt(0, this.colors.length)],
        title,
        order: 0,
      };

      this.projects.forEach((p) => {
        idbContextManager.putItem(projectTable, { ...p, order: p.order + 1 });
        p.order++;
      });

      idbContextManager.putItem(projectTable, proj);
      this.projects.push(proj);

      return proj;
    },
    edit(id: string, project: Partial<Project>): Project {
      const pIdx = this.projects.findIndex((p) => p.id === id);
      this.projects.splice(pIdx, 1, { ...this.projects[pIdx], ...project });

      idbContextManager.putItem(projectTable, this.projects[pIdx]);

      return this.projects[pIdx];
    },
  },
  getters: {
    rankedProjects(state): Project[] {
      const draftStore = useDraftsStore();

      // key - projectId
      // value - date of most recent draft with this project
      const recentTable: Record<string, string | undefined> = {};

      state.projects.forEach((p) => {
        const drafts = draftStore.getByProject(p.id);

        recentTable[p.id] = dayjs
          .max(...drafts.map((d) => dayjs(d.dateCreated)))
          ?.toISOString();
      });

      return Object.entries(recentTable)
        .sort((prev, next) => {
          if (!prev[1] && !next[1]) return 0;
          else if (!prev[1] && next[1]) return 1;
          else if (prev[1] && !next[1]) return -1;
          else return dayjs(next[1]).diff(prev[1], "milliseconds");
        })
        .map(([projectId]) => {
          return this.getOne(projectId);
        })
        .filter(Boolean) as Project[];
    },
    sortedProjects(state): Project[] {
      return state.projects.sort((prev, next) => prev["order"] - next["order"]);
    },
    withStatistics(state): ProjectStatistic[] {
      const draftStore = useDraftsStore();
      const taskStore = useTaskStore();

      // @ts-ignore
      return state.sortedProjects.map((p: Project) => {
        const draftCount = draftStore.getByProject(p.id).length;
        const taskCompletedCount = taskStore
          .getByProject(p.id)
          .filter((t) => t.status === "done").length;
        const taskActiveCount = taskStore
          .getByProject(p.id)
          .filter((t) => t.status === "todo").length;

        return {
          project: p,
          draftCount,
          taskCompletedCount,
          taskActiveCount,
        };
      });
    },
    getIndex(state): Fuse<Project> {
      return new Fuse<Project>(state.projects, {
        keys: [{ name: "title" }],
      });
    },
    getOne(state) {
      return (id: string): Project | undefined => {
        return state.projects.find((p) => p.id === id);
      };
    },
    maxOrder(state): number {
      return Math.max(...state.projects.map((p) => p.order));
    },
  },
});
