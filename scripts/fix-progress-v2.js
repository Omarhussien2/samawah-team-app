import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://txfkekganqfbuepffeos.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4Zmtla2dhbnFmYnVlcGZmZW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY3NTAxNSwiZXhwIjoyMDkzMjUxMDE1fQ.rYZPF_NhUtcFPX74ozodD9vTFhKRcBuNRNDI74-Jrow'
);

console.log('Step 1: Set progress=100 for all Done tasks...');
const { data: doneTasks, error: e2 } = await supabase
  .from('tasks')
  .update({ progress: 100 })
  .eq('status', 'Done')
  .select('id, project_id');
console.log(`Updated ${doneTasks?.length ?? 0} Done tasks to progress=100`);

console.log('\nStep 2: Recalculate all project progress...');
const { data: projects } = await supabase
  .from('projects')
  .select('id, name, progress');

for (const proj of projects ?? []) {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('status')
    .eq('project_id', proj.id);

  const total = tasks?.length ?? 0;
  const done = tasks?.filter(t => t.status === 'Done').length ?? 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  if (progress !== proj.progress) {
    const { error } = await supabase
      .from('projects')
      .update({ progress })
      .eq('id', proj.id);
    console.log(`  ${proj.name}: ${proj.progress}% -> ${progress}% ${error ? '(ERROR: ' + error.message + ')' : ''}`);
  } else {
    console.log(`  ${proj.name}: ${progress}% (unchanged)`);
  }
}

console.log('\nStep 3: Verify عقود project...');
const { data: akoud } = await supabase
  .from('projects')
  .select('name, progress')
  .ilike('name', '%عقود%')
  .single();
console.log(`${akoud?.name}: ${akoud?.progress}%`);

const { data: akoudTasks } = await supabase
  .from('tasks')
  .select('status, progress')
  .eq('project_id', projects?.find(p => p.name.includes('عقود'))?.id);
const doneWithProgress = akoudTasks?.filter(t => t.status === 'Done' && t.progress === 100).length ?? 0;
console.log(`Done tasks with progress=100: ${doneWithProgress}/${akoudTasks?.filter(t => t.status === 'Done').length}`);

console.log('\nDone!');
