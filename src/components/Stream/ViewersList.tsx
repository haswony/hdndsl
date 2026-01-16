import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { rtdb } from '../../config/firebase';

interface Viewer {
  odUserId: string;
  userName?: string;
  userPhoto?: string;
  joinedAt: number;
}

interface ViewersListProps {
  streamId: string;
}

const ViewersList: React.FC<ViewersListProps> = ({ streamId }) => {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const viewersRef = ref(rtdb, `streams/${streamId}/viewersList`);
    
    const unsubscribe = onValue(viewersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const viewerList = Object.values(data) as Viewer[];
        setViewers(viewerList.sort((a, b) => b.joinedAt - a.joinedAt));
      } else {
        setViewers([]);
      }
    });

    return () => unsubscribe();
  }, [streamId]);

  return (
    <div className="relative">
      {/* Viewer Count Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 bg-dark-100/80 backdrop-blur-sm rounded-full hover:bg-dark-100 transition-all"
      >
        <Users className="w-4 h-4 text-primary-400" />
        <span className="text-sm font-bold text-white">
          {viewers.length.toLocaleString('ar-EG')}
        </span>
        <span className="text-xs text-gray-400">مشاهد</span>
      </button>

      {/* Expanded Viewers List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-64 bg-dark-200 rounded-2xl shadow-xl border border-white/10 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-white/10">
              <h4 className="font-bold text-white">المشاهدون الآن</h4>
              <p className="text-xs text-gray-400">{viewers.length} مشاهد نشط</p>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {viewers.length > 0 ? (
                <div className="p-2 space-y-1">
                  {viewers.map((viewer, index) => (
                    <motion.div
                      key={viewer.odUserId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <img
                        src={viewer.userPhoto || `https://ui-avatars.com/api/?name=User&background=d946ef&color=fff`}
                        alt={viewer.userName || 'مشاهد'}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {viewer.userName || 'مشاهد مجهول'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          انضم منذ {Math.floor((Date.now() - viewer.joinedAt) / 60000)} د
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا يوجد مشاهدون حالياً</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ViewersList;
