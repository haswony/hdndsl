import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  Radio, Settings, Share2, Users, Heart, Play,
  Calendar, Clock, Grid, List
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import type { User, PastStream } from '../types';

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [pastStreams, setPastStreams] = useState<PastStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'streams' | 'about'>('streams');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const targetUserId = userId || currentUser?.uid;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          setProfileUser(userDoc.data() as User);
        }

        const streamsQuery = query(
          collection(db, 'streams'),
          where('hostId', '==', targetUserId),
          where('isLive', '==', false),
          orderBy('startedAt', 'desc')
        );
        const streamsSnapshot = await getDocs(streamsQuery);
        const streams = streamsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PastStream[];
        setPastStreams(streams);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetUserId]);

  const isOwnProfile = currentUser?.uid === targetUserId;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs} ساعة ${mins} دقيقة`;
    return `${mins} دقيقة`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!currentUser && !userId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-dark-100 flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">سجل الدخول</h2>
          <p className="text-gray-400 mb-6">سجل الدخول لعرض ملفك الشخصي</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-medium transition-all"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayUser = profileUser || currentUser;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-dark-200 rounded-3xl overflow-hidden mb-6"
      >
        {/* Cover Background */}
        <div className="h-32 md:h-48 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-900">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTRoLTJ2NGgyem0tNiA2aC00djJoNHYtMnptLTYgMGgtNHYyaDR2LTJ6bTEyLTEyaDJ2LTJoLTJ2MnptLTYgMGgydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        </div>

        {/* Profile Info */}
        <div className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="absolute -top-16 right-6">
            <div className="relative">
              <img
                src={displayUser?.photoURL || `https://ui-avatars.com/api/?name=${displayUser?.displayName}&background=d946ef&color=fff&size=128`}
                alt={displayUser?.displayName}
                className="w-32 h-32 rounded-full border-4 border-dark-200 object-cover"
              />
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-dark-200" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 gap-2">
            {isOwnProfile ? (
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 px-4 py-2 bg-dark-100 hover:bg-dark-100/80 text-white rounded-full transition-all"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">تعديل الملف</span>
              </button>
            ) : (
              <button className="flex items-center gap-2 px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-full transition-all">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">متابعة</span>
              </button>
            )}
            <button className="w-10 h-10 bg-dark-100 hover:bg-dark-100/80 rounded-full flex items-center justify-center transition-all">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* User Info */}
          <div className="mt-8">
            <h1 className="text-2xl font-bold text-white">{displayUser?.displayName}</h1>
            <p className="text-gray-400 mt-1">{displayUser?.email}</p>
            
            {displayUser?.bio && (
              <p className="text-gray-300 mt-3">{displayUser.bio}</p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 mt-4">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{displayUser?.followers?.toLocaleString('ar-EG') || 0}</p>
                <p className="text-sm text-gray-400">متابع</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{displayUser?.following?.toLocaleString('ar-EG') || 0}</p>
                <p className="text-sm text-gray-400">متابَع</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{pastStreams.length}</p>
                <p className="text-sm text-gray-400">بث</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 bg-dark-200 p-1 rounded-full">
          <button
            onClick={() => setActiveTab('streams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
              activeTab === 'streams'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span className="text-sm font-medium">البثوث</span>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
              activeTab === 'about'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">عن</span>
          </button>
        </div>

        {activeTab === 'streams' && (
          <div className="flex items-center gap-1 bg-dark-200 p-1 rounded-full">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-full transition-all ${
                viewMode === 'grid' ? 'bg-dark-100 text-white' : 'text-gray-400'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition-all ${
                viewMode === 'list' ? 'bg-dark-100 text-white' : 'text-gray-400'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'streams' && (
        <div>
          {pastStreams.length > 0 ? (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
              : 'space-y-4'
            }>
              {pastStreams.map((stream, index) => (
                <motion.div
                  key={stream.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={viewMode === 'grid' 
                    ? 'group cursor-pointer'
                    : 'flex items-center gap-4 bg-dark-200 p-4 rounded-2xl cursor-pointer hover:bg-dark-100 transition-all'
                  }
                >
                  {viewMode === 'grid' ? (
                    <div className="relative aspect-[9/16] md:aspect-video rounded-2xl overflow-hidden bg-dark-100">
                      <img
                        src={stream.coverImage || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800'}
                        alt={stream.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-300 via-transparent to-transparent" />
                      
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                        <Clock className="w-3 h-3 text-white" />
                        <span className="text-xs text-white">{formatDuration(stream.duration || 0)}</span>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">
                          {stream.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <Calendar className="w-3 h-3" />
                          {formatDate(stream.recordedAt)}
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-primary-500/90 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative w-40 aspect-video rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          src={stream.coverImage || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800'}
                          alt={stream.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold mb-1 line-clamp-1">{stream.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(stream.duration || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(stream.recordedAt)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-dark-100 flex items-center justify-center mb-4">
                <Radio className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">لا توجد بثوث سابقة</h3>
              <p className="text-gray-400 mb-6">
                {isOwnProfile ? 'ابدأ بثك الأول وشارك لحظاتك!' : 'هذا المستخدم لم يقم ببث بعد'}
              </p>
              {isOwnProfile && (
                <button
                  onClick={() => navigate('/start-live')}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-medium transition-all"
                >
                  ابدأ البث الآن
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-200 rounded-2xl p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">عن {displayUser?.displayName}</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">النبذة</p>
              <p className="text-white">{displayUser?.bio || 'لا توجد نبذة'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-1">تاريخ الانضمام</p>
              <p className="text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(displayUser?.createdAt || Date.now())}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Profile;
