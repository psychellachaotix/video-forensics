import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';

export function Scene5() {
  return (
    <SceneLayout className="bg-primary flex items-center justify-center relative overflow-hidden">
      
      {/* Dynamic Background */}
      <motion.div 
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,17,21,0.1)_2px,transparent_2px),linear-gradient(90deg,rgba(14,17,21,0.1)_2px,transparent_2px)] bg-[size:2vw_2vw]" />
      </motion.div>

      <SafeFrame className="flex flex-col items-center justify-center h-full z-10">
        
        <motion.div 
          className="flex flex-col items-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, type: "spring", bounce: 0.4 }}
        >
          {/* Logo Mark Inverted */}
          <div className="w-20 h-20 border-4 border-bg-dark rounded-md flex items-center justify-center bg-transparent relative overflow-hidden mb-8">
            <div className="w-10 h-10 bg-bg-dark rounded-sm" />
          </div>

          <VideoText
            className="text-bg-dark font-display font-bold tracking-tight text-center leading-none"
            size="5xl"
          >
            Video<br/>Forensics
          </VideoText>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-8 border-t-2 border-bg-dark/30 pt-4"
          >
            <VideoText
              className="text-bg-dark/80 font-mono tracking-[0.3em]"
              size="sm"
            >
              TECHNICAL PROOF OF CONCEPT
            </VideoText>
          </motion.div>
        </motion.div>

      </SafeFrame>
    </SceneLayout>
  );
}