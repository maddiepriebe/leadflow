import { Button } from '@leadflow/ui';

export default function ICPPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Ideal Customer Profile
        </h1>
        <Button>Create ICP</Button>
      </div>
      
      <div className="bg-white shadow sm:rounded-lg p-6">
        <p className="text-gray-500">
          Define your ideal customer criteria. This helps target the right leads.
        </p>
      </div>
    </div>
  );
}