import { useState } from 'react';
import { Plus, Edit3, CheckSquare } from 'lucide-react';
import { TaskModal } from './TaskModal';
import { PostModal } from './PostModal';

export function GlobalFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Expanded Menu */}
        <div 
          className={`flex flex-col gap-3 transition-all duration-300 origin-bottom ${
            isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-8 pointer-events-none'
          }`}
        >
          <button
            onClick={() => {
              setTaskModalOpen(true);
              setIsOpen(false);
            }}
            className="flex items-center gap-3 bg-card text-foreground px-4 py-2.5 rounded-full shadow-lg border border-border hover:bg-accent/10 hover:text-accent transition-colors"
          >
            <span className="font-medium text-sm">Add Task</span>
            <div className="bg-accent/20 p-2 rounded-full text-accent">
              <CheckSquare className="h-4 w-4" />
            </div>
          </button>
          
          <button
            onClick={() => {
              setPostModalOpen(true);
              setIsOpen(false);
            }}
            className="flex items-center gap-3 bg-card text-foreground px-4 py-2.5 rounded-full shadow-lg border border-border hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <span className="font-medium text-sm">Post Update</span>
            <div className="bg-primary/20 p-2 rounded-full text-primary">
              <Edit3 className="h-4 w-4" />
            </div>
          </button>
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`h-14 w-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
            isOpen ? 'bg-danger text-white rotate-45' : 'bg-primary text-primary-foreground hover:scale-105'
          }`}
        >
          {isOpen ? <Plus className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      <TaskModal isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} />
      <PostModal isOpen={postModalOpen} onClose={() => setPostModalOpen(false)} />
    </>
  );
}
