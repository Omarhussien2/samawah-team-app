import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://txfkekganqfbuepffeos.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4Zmtla2dhbnFmYnVlcGZmZW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY3NTAxNSwiZXhwIjoyMDkzMjUxMDE1fQ.rYZPF_NhUtcFPX74ozodD9vTFhKRcBuNRNDI74-Jrow'
);

const { data: projects } = await supabase
  .from('projects')
  .select('id, name, progress')
  .ilike('name', '%عقود%');

console.log('=== Projects matching عقود ===');
console.log(JSON.stringify(projects, null, 2));

if (projects && projects.length > 0) {
  for (const proj of projects) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, progress, board_column')
      .eq('project_id', proj.id);

    const totalTasks = tasks?.length || 0;
    const doneTasks = tasks?.filter(t => t.status === 'Done').length || 0;
    const inProgress = tasks?.filter(t => t.status === 'In Progress').length || 0;
    const toDo = tasks?.filter(t => t.status === 'To Do').length || 0;
    const backlog = tasks?.filter(t => t.status === 'Backlog').length || 0;
    const review = tasks?.filter(t => t.status === 'Review').length || 0;

    const correctProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    console.log(`\n=== ${proj.name} ===`);
    console.log(`Stored progress: ${proj.progress}%`);
    console.log(`Calculated (Done/Total): ${correctProgress}%`);
    console.log(`Total: ${totalTasks} | Done: ${doneTasks} | In Progress: ${inProgress} | To Do: ${toDo} | Backlog: ${backlog} | Review: ${review}`);

    // Check if tasks have progress field set
    const tasksWithProgress = tasks?.filter(t => (t.progress ?? 0) > 0);
    console.log(`Tasks with progress > 0: ${tasksWithProgress?.length}`);

    // Check board_column vs status mismatch
    const mismatched = tasks?.filter(t => t.board_column !== t.status);
    console.log(`Tasks with board_column !== status: ${mismatched?.length}`);
    if (mismatched?.length > 0) {
      mismatched.slice(0, 3).forEach(t => {
        console.log(`  MISMATCH: status=${t.status} | board_column=${t.board_column} | ${t.title?.substring(0, 40)}`);
      });
    }

    console.log('\nAll tasks:');
    tasks?.forEach(t => {
      console.log(`  ${t.status.padEnd(12)} | progress: ${String(t.progress ?? 0).padStart(3)}% | board: ${(t.board_column || 'null').padEnd(12)} | ${t.title?.substring(0, 50)}`);
    });
  }
}
