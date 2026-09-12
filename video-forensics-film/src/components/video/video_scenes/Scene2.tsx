import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';

export function Scene2() {
  return (
    <SceneLayout className="bg-bg-dark relative overflow-hidden">
      
      {/* Dynamic Grid Background */}
      <motion.div 
        className="absolute inset-0 bg-[linear-gradient(rgba(190,223,53,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(190,223,53,0.1)_1px,transparent_1px)] bg-[size:4vw_4vw]"
        initial={{ opacity: 0, scale: 1.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />

      <SafeFrame className="flex flex-col h-full z-10 px-[6vw] py-[8vh]">
        
        {/* Header */}
        <motion.div
          className="flex justify-between items-end border-b border-primary/30 pb-[2vh] mb-[6vh]"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div>
            <VideoText className="text-primary font-mono tracking-[0.2em] mb-2" size="xs">
              PHASE 02 / INSPECTION
            </VideoText>
            <VideoText className="text-text-primary font-display font-semibold" size="2xl">
              Technical Metadata
            </VideoText>
          </div>
          <VideoText className="text-text-secondary font-mono" size="xs">
            FFPROBE_ANALYSIS_ACTIVE
          </VideoText>
        </motion.div>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-3 gap-[2vw]">
          
          {/* Main Visual */}
          <motion.div 
            className="col-span-2 relative border border-secondary bg-bg-muted overflow-hidden"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
             <img src={`${import.meta.env.BASE_URL}images/video-evidence.jpg`} className="w-full h-full object-cover opacity-80" />
             
             {/* Reticle Overlay */}
             <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] aspect-square border border-primary/50"
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, delay: 0.8, type: "spring" }}
             >
               <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
               <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
               <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
               <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
             </motion.div>
             
             <div className="absolute bottom-0 left-0 right-0 bg-bg-dark/90 p-[1vw] border-t border-secondary flex justify-between items-center backdrop-blur-sm">
               <VideoText className="text-primary font-mono" size="xs">SHA-256: E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855</VideoText>
             </div>
          </motion.div>

          {/* Data Readout */}
          <div className="col-span-1 flex flex-col gap-[1vw]">
            {[
              { label: "CONTAINER", value: "mp4", delay: 0.4 },
              { label: "CODEC", value: "h264", delay: 0.5 },
              { label: "RESOLUTION", value: "1920x1080", delay: 0.6 },
              { label: "ENCODER", value: "Lavf59.27.100", delay: 0.7 },
              { label: "HEURISTIC", value: "EDIT_INDICATORS_FOUND", delay: 0.8, alert: true }
            ].map((item, i) => (
              <motion.div 
                key={i}
                className={`p-[1.5vw] border ${item.alert ? 'border-accent bg-accent/10' : 'border-secondary bg-bg-muted'} flex flex-col gap-2`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: item.delay }}
              >
                <VideoText className="text-text-secondary font-mono tracking-widest" size="xs">
                  {item.label}
                </VideoText>
                <VideoText className={`${item.alert ? 'text-accent' : 'text-text-primary'} font-mono`} size="sm">
                  {item.value}
                </VideoText>
              </motion.div>
            ))}
          </div>

        </div>
      </SafeFrame>
    </SceneLayout>
  );
}