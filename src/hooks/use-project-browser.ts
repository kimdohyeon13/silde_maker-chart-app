"use client";

import { useEffect, useState } from "react";
import type { VisualAnalysis } from "@/lib/analysis/schema";
import { fetchProjectAnalyses, fetchProjects } from "@/lib/project-api";
import type { ProjectListItem } from "@/lib/project-types";

const DEMO_PROJECT_SLUG = "demo";
const EMPTY_ANALYSES: VisualAnalysis[] = [];

interface UseProjectBrowserOptions {
  demoAnalyses?: VisualAnalysis[];
  initialProjectQuery?: string;
}

export function useProjectBrowser(
  options: UseProjectBrowserOptions = {}
) {
  const initialProjectQuery = options.initialProjectQuery;
  const demoAnalyses = options.demoAnalyses ?? EMPTY_ANALYSES;
  const hasDemoData = demoAnalyses.length > 0;

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    hasDemoData ? DEMO_PROJECT_SLUG : ""
  );
  const [analyses, setAnalyses] = useState<VisualAnalysis[]>(demoAnalyses);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const nextProjects = await fetchProjects();
        if (cancelled) {
          return;
        }

        setProjects(nextProjects);
        setSelectedProject((currentProject) => {
          if (
            currentProject &&
            currentProject !== DEMO_PROJECT_SLUG &&
            nextProjects.some((project) => project.slug === currentProject)
          ) {
            return currentProject;
          }

          const requested = initialProjectQuery
            ? new URLSearchParams(window.location.search).get(initialProjectQuery)
            : null;
          if (requested && nextProjects.some((project) => project.slug === requested)) {
            return requested;
          }

          const firstReadyProject =
            nextProjects.find((project) => project.analysisCount > 0) ??
            nextProjects[0];

          return firstReadyProject?.slug ?? (hasDemoData ? DEMO_PROJECT_SLUG : "");
        });
      } catch {
        if (!cancelled) {
          setProjects([]);
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [hasDemoData, initialProjectQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalyses() {
      if (selectedProject === DEMO_PROJECT_SLUG && hasDemoData) {
        setAnalyses(demoAnalyses);
        setLoading(false);
        return;
      }

      if (!selectedProject) {
        setAnalyses([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const nextAnalyses = await fetchProjectAnalyses(selectedProject);
        if (!cancelled) {
          setAnalyses(nextAnalyses);
        }
      } catch {
        if (!cancelled) {
          setAnalyses([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAnalyses();

    return () => {
      cancelled = true;
    };
  }, [demoAnalyses, hasDemoData, selectedProject]);

  return {
    analyses,
    currentProject: projects.find((project) => project.slug === selectedProject),
    demoProjectSlug: DEMO_PROJECT_SLUG,
    loading,
    projects,
    selectedProject,
    setSelectedProject,
  };
}
