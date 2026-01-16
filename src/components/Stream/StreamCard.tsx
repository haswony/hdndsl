import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Stream } from '../../types';

interface StreamCardProps {
  stream: Stream;
  index?: number;
}

const StreamCard: React.FC<StreamCardProps> = ({ stream, index = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link
        to={`/watch/${stream.id}`}
        className="block group"
      >
        <div className="relative aspect-[9/16] md:aspect-video rounded-2xl overflow-hidden bg-dark-100">
          {/* Cover Image */}
          <img
            src={stream.coverImage || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800'}
            alt={stream.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-300 via-transparent to-transparent" />
          
          {/* Live Badge */}
          {stream.isLive && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-bold text-white">LIVE</span>
            </div>
          )}
          
          {/* Viewer Count */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
            <Eye className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-medium text-white">
              {stream.viewerCount.toLocaleString('ar-EG')}
            </span>
          </div>
          
          {/* Stream Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
              {stream.title}
            </h3>
            
            <div className="flex items-center gap-2">
              <img
                src={stream.hostPhoto || `https://ui-avatars.com/api/?name=${stream.hostName}&background=d946ef&color=fff`}
                alt={stream.hostName}
                className="w-8 h-8 rounded-full border-2 border-primary-500"
              />
              <span className="text-sm text-gray-300 font-medium">
                {stream.hostName}
              </span>
            </div>
          </div>
          
          {/* Hover Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 rounded-full bg-primary-500/90 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform">
              <Radio className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default StreamCard;
