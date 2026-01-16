import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  User, Camera, Bell, Shield, Moon, Globe, 
  LogOut, ChevronLeft, Save, Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db, storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsLoading(true);
      const imageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      setPhotoURL(url);
    } catch (err) {
      console.error('Error uploading photo:', err);
      alert('فشل في رفع الصورة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        bio,
        photoURL,
      });
      alert('تم حفظ التغييرات بنجاح!');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('فشل في حفظ التغييرات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('هل تريد تسجيل الخروج؟')) {
      await signOut();
      navigate('/');
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-2xl font-bold text-white mb-2">سجل الدخول</h2>
          <p className="text-gray-400 mb-6">سجل الدخول للوصول للإعدادات</p>
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

  const settingsSections = [
    { id: 'profile', icon: User, label: 'الملف الشخصي' },
    { id: 'notifications', icon: Bell, label: 'الإشعارات' },
    { id: 'privacy', icon: Shield, label: 'الخصوصية' },
    { id: 'appearance', icon: Moon, label: 'المظهر' },
    { id: 'language', icon: Globe, label: 'اللغة' },
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-dark-100 hover:bg-dark-100/80 rounded-full flex items-center justify-center transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">الإعدادات</h1>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-dark-200 rounded-2xl p-2 space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeSection === section.id
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <section.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              ))}

              <hr className="border-white/10 my-2" />

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">تسجيل الخروج</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="md:col-span-3">
            {activeSection === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-200 rounded-2xl p-6"
              >
                <h2 className="text-lg font-bold text-white mb-6">الملف الشخصي</h2>

                {/* Avatar */}
                <div className="flex items-center gap-6 mb-6">
                  <div className="relative">
                    <img
                      src={photoURL || `https://ui-avatars.com/api/?name=${displayName}&background=d946ef&color=fff&size=96`}
                      alt={displayName}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center transition-all"
                    >
                      <Camera className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{user.displayName}</h3>
                    <p className="text-sm text-gray-400">{user.email}</p>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      الاسم المعروض
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-dark-100 text-white placeholder-gray-500 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      النبذة
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      placeholder="اكتب نبذة عنك..."
                      className="w-full bg-dark-100 text-white placeholder-gray-500 px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 text-white rounded-xl font-medium transition-all"
                  >
                    <Save className="w-5 h-5" />
                    {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                </div>
              </motion.div>
            )}

            {activeSection === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-200 rounded-2xl p-6"
              >
                <h2 className="text-lg font-bold text-white mb-6">إعدادات الإشعارات</h2>
                
                <div className="space-y-4">
                  {[
                    { label: 'إشعارات البث المباشر', desc: 'عندما يبدأ شخص تتابعه بثًا' },
                    { label: 'إشعارات التعليقات', desc: 'عندما يعلق أحد على بثك' },
                    { label: 'إشعارات المتابعين', desc: 'عندما يتابعك شخص جديد' },
                    { label: 'إشعارات الإعجابات', desc: 'عندما يعجب أحد ببثك' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-dark-100 rounded-xl">
                      <div>
                        <p className="font-medium text-white">{item.label}</p>
                        <p className="text-sm text-gray-400">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeSection === 'privacy' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-200 rounded-2xl p-6"
              >
                <h2 className="text-lg font-bold text-white mb-6">إعدادات الخصوصية</h2>
                
                <div className="space-y-4">
                  {[
                    { label: 'حساب خاص', desc: 'يمكن للمتابعين فقط مشاهدة بثوثك' },
                    { label: 'إخفاء عدد المتابعين', desc: 'لن يظهر عدد المتابعين للآخرين' },
                    { label: 'السماح بالرسائل', desc: 'السماح للآخرين بإرسال رسائل لك' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-dark-100 rounded-xl">
                      <div>
                        <p className="font-medium text-white">{item.label}</p>
                        <p className="text-sm text-gray-400">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-white/10">
                    <button className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-all">
                      <Trash2 className="w-5 h-5" />
                      <span>حذف الحساب</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'appearance' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-200 rounded-2xl p-6"
              >
                <h2 className="text-lg font-bold text-white mb-6">المظهر</h2>
                
                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-white mb-3">اختر المظهر</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'dark', label: 'داكن', active: true },
                        { id: 'light', label: 'فاتح', active: false },
                        { id: 'system', label: 'تلقائي', active: false },
                      ].map((theme) => (
                        <button
                          key={theme.id}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            theme.active
                              ? 'border-primary-500 bg-primary-500/10'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-full aspect-video rounded-lg mb-2 ${
                            theme.id === 'dark' ? 'bg-dark-400' : theme.id === 'light' ? 'bg-gray-200' : 'bg-gradient-to-r from-dark-400 to-gray-200'
                          }`} />
                          <p className={`text-sm font-medium ${theme.active ? 'text-primary-400' : 'text-gray-400'}`}>
                            {theme.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'language' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-200 rounded-2xl p-6"
              >
                <h2 className="text-lg font-bold text-white mb-6">اللغة</h2>
                
                <div className="space-y-2">
                  {[
                    { code: 'ar', label: 'العربية', active: true },
                    { code: 'en', label: 'English', active: false },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                        lang.active
                          ? 'bg-primary-500/20 text-primary-400'
                          : 'bg-dark-100 text-gray-400 hover:bg-dark-100/80'
                      }`}
                    >
                      <span className="font-medium">{lang.label}</span>
                      {lang.active && (
                        <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
