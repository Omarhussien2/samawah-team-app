import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://txfkekganqfbuepffeos.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4Zmtla2dhbnFmYnVlcGZmZW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY3NTAxNSwiZXhwIjoyMDkzMjUxMDE1fQ.rYZPF_NhUtcFPX74ozodD9vTFhKRcBuNRNDI74-Jrow'
);

const { data: projects } = await supabase.from('projects').select('id, name, progress').order('name');

console.log('=== All Projects Progress ===');
for (const p of projects ?? []) {
  const { data: tasks } = await supabase.from('tasks').select('status, progress').eq('project_id', p.id);
  const total = tasks?.length ?? 0;
  const done = tasks?.filter(t => t.status === 'Done').length ?? 0;
  const doneProgress = tasks?.filter(t => t.status === 'Done' && Number(t.progress) === 100).length ?? 0;
  const expected = total > 0 ? Math.round((done / total) * 100) : 0;
  const match = Number(p.progress) === expected ? '✓' : '✗ SHOULD BE ' + expected + '%';
  console.log(`${String(p.progress).padStart(3)}% ${match} | ${done}/${total} done | doneWith100=${doneProgress} | ${p.name}`);
}

// Check the عقود project specifically
const { data: akoud } = await supabase.from('projects').select('*').ilike('name', '%عقود%').single();
if (akoud) {
  const { data: tasks } = await supabase.from('tasks').select('title, status, progress').eq('project_id', akoud.id).eq('status', 'Done');
  console.log('\n=== عقود Done Tasks ===');
  tasks?.forEach(t => console.log(`  progress=${t.progress} | ${t.title}`));
}
