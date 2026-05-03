import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://txfkekganqfbuepffeos.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4Zmtla2dhbnFmYnVlcGZmZW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY3NTAxNSwiZXhwIjoyMDkzMjUxMDE1fQ.rYZPF_NhUtcFPX74ozodD9vTFhKRcBuNRNDI74-Jrow'
);

console.log('Fixing Done tasks: set quantity_done=1, quantity_total=1, progress=100...');
const { data: updated, error } = await supabase
  .from('tasks')
  .update({ quantity_done: 1, quantity_total: 1, progress: 100 })
  .eq('status', 'Done')
  .select('id');

if (error) {
  console.log('Error:', error.message);
} else {
  console.log(`Updated ${updated?.length ?? 0} Done tasks`);
}

// Verify
console.log('\nVerifying عقود project...');
const { data: proj } = await supabase.from('projects').select('id, name, progress').ilike('name', '%عقود%').single();
const { data: tasks } = await supabase.from('tasks').select('title, status, progress, quantity_done, quantity_total').eq('project_id', proj.id).eq('status', 'Done');
console.log(`${proj.name}: ${proj.progress}%`);
tasks?.forEach(t => console.log(`  qd=${t.quantity_done} qt=${t.quantity_total} p=${t.progress} | ${t.title}`));

// Recalculate project progress
const { data: allTasks } = await supabase.from('tasks').select('status').eq('project_id', proj.id);
const total = allTasks?.length ?? 0;
const done = allTasks?.filter(t => t.status === 'Done').length ?? 0;
const progress = Math.round((done / total) * 100);
await supabase.from('projects').update({ progress }).eq('id', proj.id);
console.log(`\nRecalculated: ${progress}% (${done}/${total})`);
