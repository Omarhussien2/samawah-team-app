export function getTaskDisplayLines({
  title,
  subTask,
  category,
}: {
  title: string;
  subTask?: string | null;
  category?: string | null;
}) {
  const cleanSubTask = subTask?.trim();
  const cleanCategory = category?.trim();

  return {
    primary: cleanSubTask || title,
    secondary: cleanCategory || (cleanSubTask ? title : null),
  };
}
