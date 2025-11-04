import { Button } from '@leadflow/ui';

export default function SequencesPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sequences</h1>
        <Button>Create Sequence</Button>
      </div>
      
      <div className="bg-white shadow sm:rounded-lg p-6">
        <p className="text-gray-500">
          Create automated message sequences to nurture leads.
        </p>
      </div>
    </div>
  );
}