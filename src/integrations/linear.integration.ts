import {
  Integration,
  IntegrationProject,
  IntegrationTask,
} from "@models/integration.model.ts";
import { Issue, ProjectConnection } from "@linear/sdk";
import { ApiKey } from "@models/api-key.model.ts";

export class LinearIntegration implements Integration {
  name = "linear";
  description =
    "Linear is a better way to build products\nMeet the new standard for modern software development.Streamline issues, sprints, and product roadmaps.";
  iconURL = "/img/integrations/linear.svg";

  constructor(public id: string) {}

  async checkToken(apiKey: string): Promise<boolean> {
    try {
      const { ok } = await fetch(`/api/linear/check_token`, {
        headers: { Authorization: apiKey },
      }).then((r) => r.json());

      return ok;
    } catch (e) {
      return false;
    }
  }

  projectsCache: IntegrationProject[] = [];
  apiKeys: ApiKey[] = [];

  async fetchProjects(): Promise<IntegrationProject[]> {
    if (!this.apiKeys.length) throw new Error(`${this.name} apiKey is missing`);

    const req = this.apiKeys.map((apiKey) =>
      fetch(`/api/linear/get_projects`, {
        headers: { Authorization: apiKey.key },
      }).then((r) => r.json()),
    );
    const res: ProjectConnection[] = await Promise.all(req);

    const projects = res.map((r) => r.nodes).flat();
    this.projectsCache = projects;

    return projects.map((p) => ({ name: p.name, id: p.id }));
  }

  async *fetchTasks(): AsyncGenerator<IntegrationTask[]> {
    if (!this.apiKeys.length) throw new Error(`${this.name} apiKey is missing`);

    for (const apiKey of this.apiKeys) {
      const chunk = await fetch(`/api/linear/get_tasks`, {
        headers: { Authorization: apiKey.key },
      }).then((r) => r.json());

      yield chunk.map((t: Issue) => {
        // @ts-ignore
        const project = this.projectsCache.find((p) => p.id === t._project?.id);

        return {
          id: t.id,
          title: t.title,
          createdAt: t.createdAt as unknown as string,
          updatedAt: t.updatedAt as unknown as string,
          link: t.url,
          iconURL: this.iconURL,
          integrationName: this.name,
          projectTitle: project?.name ?? "",
          projectId: project?.id ?? "",
        };
      });
    }
  }
}
