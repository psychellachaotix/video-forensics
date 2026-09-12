import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';

export function Scene0() {
  return (
    <SceneLayout className="bg-bg-dark flex items-center justify-center relative overflow-hidden instrument-grid">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(190,223,53,0.05),transparent_60%)]" />
      
      {/* Decorative background motion elements */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[50vh] h-[50vh] bg-primary/5 rounded-full blur-[100px]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1.2 }}
        transition={{ duration: 4, ease: "easeOut" }}
      />

      <SafeFrame className="flex flex-col items-center justify-center h-full z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="flex flex-col items-center"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div 
              className="w-16 h-16 border-2 border-primary rounded-md flex items-center justify-center bg-bg-dark relative overflow-hidden"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 1, ease: "backOut", delay: 0.5 }}
            >
              <motion.div 
                className="w-8 h-8 bg-primary rounded-sm"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 1 }}
              />
              <motion.div 
                className="absolute inset-0 bg-primary/20"
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
            
            <VideoText
              className="text-primary font-mono tracking-[0.2em] font-medium"
              size="sm"
            >
              PROJECT INITIATION
            </VideoText>
          </div>

          <VideoText
            className="text-text-primary font-display font-bold tracking-tight text-center leading-tight max-w-[80vw]"
            size="4xl"
          >
            Video Forensics
          </VideoText>
          
          <VideoText
            className="text-text-secondary font-mono mt-8 max-w-[60vw] text-center leading-relaxed"
            size="md"
          >
            A cinematic look at the evidence intake, technical inspection, and AI verification roadmap.
          </VideoText>
        </motion.div>
      </SafeFrame>
    </SceneLayout>
  );
}