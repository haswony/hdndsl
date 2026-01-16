import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingHeart {
  id: number;
  x: number;
}

interface HeartAnimationProps {
  onLike: () => void;
}

const HeartAnimation: React.FC<HeartAnimationProps> = ({ onLike }) => {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const addHeart = () => {
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: Math.random() * 60 - 30,
    };
    setHearts((prev) => [...prev, newHeart]);
    onLike();

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2000);
  };

  return (
    <div className="relative">
      {/* Floating Hearts Container */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-20 h-40 pointer-events-none overflow-visible">
        <AnimatePresence>
          {hearts.map((heart) => (
            <motion.div
              key={heart.id}
              initial={{ y: 0, x: heart.x, opacity: 1, scale: 0.5 }}
              animate={{
                y: -150,
                x: heart.x + Math.random() * 20 - 10,
                opacity: 0,
                scale: 1.2,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute bottom-0 left-1/2"
            >
              <Heart
                className="w-8 h-8 text-red-500 fill-red-500"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))',
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Like Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={addHeart}
        className="w-14 h-14 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 active:shadow-red-500/50 transition-shadow"
      >
        <Heart className="w-7 h-7 text-white fill-white" />
      </motion.button>
    </div>
  );
};

export default HeartAnimation;
