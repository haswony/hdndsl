import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Radio, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../config/firebase';
import StreamCard from '../components/Stream/StreamCard';
import type { Stream } from '../types';

const Home: React.FC = () => {
  const [liveStreams, setLiveStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const streamsRef = collection(db, 'streams');
    const q = query(
      streamsRef,
      where('isLive', '==', true),
      orderBy('viewerCount', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const streams = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Stream[];
      setLiveStreams(streams);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const categories = [
    { id: 'all', label: 'الكل', icon: Sparkles },
    { id: 'trending', label: 'الأكثر مشاهدة', icon: TrendingUp },
    { id: 'recent', label: 'الأحدث', icon: Clock },
  ];

  const [activeCategory, setActiveCategory] = useState('all');

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-purple-900 p-8 mb-8"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTRoLTJ2NGgyem0tNiA2aC00djJoNHYtMnptLTYgMGgtNHYyaDR2LTJ6bTEyLTEyaDJ2LTJoLTJ2MnptLTYgMGgydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Hasndel Live
              </h1>
              <p className="text-primary-200">هاسنديل لايف</p>
            </div>
          </div>
          
          <p className="text-white/80 text-lg mb-6 max-w-xl">
            منصة البث المباشر للتواصل والترفيه. شارك لحظاتك مع العالم وتفاعل مع جمهورك في الوقت الحقيقي.
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white font-medium">
                {liveStreams.length} بث مباشر الآن
              </span>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-4 left-4 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-4 right-4 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
      </motion.div>

      {/* Categories */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? 'bg-primary-500 text-white'
                : 'bg-dark-100 text-gray-400 hover:bg-dark-100/80 hover:text-white'
            }`}
          >
            <cat.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Live Now Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-xl font-bold text-white">البثوث المباشرة</h2>
          </div>
          <span className="text-sm text-gray-400">
            {liveStreams.length} بث نشط
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-[9/16] md:aspect-video rounded-2xl bg-dark-100 animate-pulse"
              />
            ))}
          </div>
        ) : liveStreams.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {liveStreams.map((stream, index) => (
              <StreamCard key={stream.id} stream={stream} index={index} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-dark-100 flex items-center justify-center mb-4">
              <Radio className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              لا توجد بثوث مباشرة حالياً
            </h3>
            <p className="text-gray-400 mb-6">
              كن أول من يبدأ بثًا مباشرًا وشارك لحظاتك!
            </p>
            <a
              href="/start-live"
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-medium transition-all"
            >
              ابدأ البث الآن
            </a>
          </motion.div>
        )}
      </section>

      {/* Demo Streams for UI Display */}
      {liveStreams.length === 0 && !loading && (
        <section>
          <h2 className="text-xl font-bold text-white mb-4">بثوث مقترحة</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {demoStreams.map((stream, index) => (
              <StreamCard key={stream.id} stream={stream} index={index} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const demoStreams: Stream[] = [
  {
    id: 'demo-1',
    title: 'جلسة دردشة مسائية مع المتابعين',
    hostId: 'demo-host-1',
    hostName: 'أحمد محمد',
    hostPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    coverImage: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800',
    viewerCount: 1250,
    isLive: true,
    startedAt: Date.now() - 3600000,
  },
  {
    id: 'demo-2',
    title: 'لقاء مباشر - أسئلة وأجوبة',
    hostId: 'demo-host-2',
    hostName: 'سارة علي',
    hostPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    coverImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
    viewerCount: 890,
    isLive: true,
    startedAt: Date.now() - 1800000,
  },
  {
    id: 'demo-3',
    title: 'جلسة ترفيهية وضحك',
    hostId: 'demo-host-3',
    hostName: 'خالد العمري',
    hostPhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    coverImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
    viewerCount: 567,
    isLive: true,
    startedAt: Date.now() - 7200000,
  },
  {
    id: 'demo-4',
    title: 'سهرة مع المتابعين',
    hostId: 'demo-host-4',
    hostName: 'نورة السالم',
    hostPhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    coverImage: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
    viewerCount: 432,
    isLive: true,
    startedAt: Date.now() - 5400000,
  },
];

export default Home;
