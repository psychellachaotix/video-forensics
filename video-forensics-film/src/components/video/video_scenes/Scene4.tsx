import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';

export function Scene4() {
  return (
    <SceneLayout className="bg-bg-dark relative overflow-hidden">
      
      {/* Background Image */}
      <motion.div 
        className="absolute inset-0 z-0"
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 3, ease: "easeOut" }}
      >
        <img src={`${import.meta.env.BASE_URL}images/ai-brain.jpg`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/50 to-transparent" />
      </motion.div>

      <SafeFrame className="flex flex-col h-full z-10 p-[6vw] justify-between">
        
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <VideoText className="text-primary font-mono tracking-[0.2em] mb-4" size="xs">
            ROADMAP / FUTURE CAPABILITY
          </VideoText>
          <VideoText className="text-text-primary font-display font-bold max-w-[60vw]" size="4xl">
            Dual-Agent AI Verification
          </VideoText>
        </motion.div>

        <div className="flex gap-[4vw]">
          {/* Agent 1: Interpreter */}
          <motion.div 
            className="flex-1 border-l-2 border-primary/50 pl-[2vw] py-[2vh] bg-gradient-to-r from-bg-dark/80 to-transparent backdrop-blur-sm"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1 }}
          >
            <VideoText className="text-primary font-mono mb-2" size="xs">AGENT_01</VideoText>
            <VideoText className="text-text-primary font-display font-semibold mb-4" size="xl">The Interpreter</VideoText>
            <VideoText className="text-text-secondary font-body leading-relaxed" size="sm">
              Analyzes raw FFprobe metadata to detect anomalies, mismatched encoder tags, and timeline inconsistencies.
            </VideoText>
          </motion.div>

          {/* Agent 2: Verifier */}
          <motion.div 
            className="flex-1 border-l-2 border-accent/50 pl-[2vw] py-[2vh] bg-gradient-to-r from-bg-dark/80 to-transparent backdrop-blur-sm"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1.5 }}
          >
            <VideoText className="text-accent font-mono mb-2" size="xs">AGENT_02</VideoText>
            <VideoText className="text-text-primary font-display font-semibold mb-4" size="xl">The Verifier</VideoText>
            <VideoText className="text-text-secondary font-body leading-relaxed" size="sm">
              Critiques the Interpreter's findings, demanding concrete evidence for claims of manipulation before final verdict.
            </VideoText>
          </motion.div>
        </div>
        
      </SafeFrame>
    </SceneLayout>
  );
}