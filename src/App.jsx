import { useState, useRef, useEffect } from 'react';
import heic2any from 'heic2any';
import { Upload, Share, RotateCcw, Calendar, Type, Sparkles, X, Download, Smartphone, Monitor, Box, Camera, Sun, StickyNote, CircleDashed, ZoomIn } from 'lucide-react';

const PolaroidStudio = () => {
  // --- STATE ---
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [frameColor, setFrameColor] = useState('#ffffff');
  const [isProcessing, setIsProcessing] = useState(false);
  const [format, setFormat] = useState('square');

  // EFFECTS
  const [showDate, setShowDate] = useState(true);
  const [showGrain, setShowGrain] = useState(true);
  const [showLeak, setShowLeak] = useState(false);
  const [showTape, setShowTape] = useState(false);
  const [showVignette, setShowVignette] = useState(true);

  const [fontType, setFontType] = useState('hand'); 
  const [dateStr, setDateStr] = useState("'98 04 25");
  const [activeFilter, setActiveFilter] = useState('vintage');

  // ZOOM & POSITION
  const [zoom, setZoom] = useState(1);
  const [baseDims, setBaseDims] = useState({ w: 0, h: 0 }); 
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Animation & 3D
  const [isDeveloping, setIsDeveloping] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [generatedImage, setGeneratedImage] = useState(null); 

  // Refs
  const fileInputRef = useRef(null);
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // --- CONFIG ---
  const filterStyles = {
    normal: 'none',
    vintage: 'contrast(1.2) sepia(0.2) saturate(0.85) hue-rotate(-5deg) brightness(1.05) blur(0.5px)',
    bw: 'grayscale(1) contrast(1.2) brightness(1.1) blur(0.5px)',
    warm: 'sepia(0.4) saturate(1.2) contrast(1.1) blur(0.5px)',
    cool: 'contrast(1.1) saturate(1.1) hue-rotate(10deg) brightness(1.1) sepia(0.1) blur(0.5px)',
    dramatic: 'contrast(1.4) saturate(1.2) sepia(0.1) brightness(0.9) blur(0.5px)'
  };

  const formatConfig = {
    square: { 
        label: 'Square', icon: <Box size={14} />, 
        frameClass: 'max-w-[420px]', 
        aspectClass: 'aspect-square', 
        padding: '30px 30px 100px 30px', 
        exportWidth: 1080 
    },
    mini: { 
        label: 'Mini', icon: <Smartphone size={14} />, 
        frameClass: 'max-w-[340px]', 
        aspectClass: 'aspect-[3/4]', 
        padding: '25px 25px 110px 25px', 
        exportWidth: 800 
    },
    wide: { 
        label: 'Wide', icon: <Monitor size={14} />, 
        frameClass: 'max-w-[520px]', 
        aspectClass: 'aspect-[4/3]', 
        padding: '30px 30px 90px 30px', 
        exportWidth: 1200 
    }
  };
  const currentFormat = formatConfig[format];

  // --- LOGIC ---
  const handleMouseMove = (e) => {
    if (!containerRef.current || isDragging || window.innerWidth < 768) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xRot = ((y - rect.height / 2) / rect.height) * -6;
    const yRot = ((x - rect.width / 2) / rect.width) * 6;
    setTilt({ x: xRot, y: yRot });
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const fileName = file.name.toLowerCase();
      const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif');
      let blob = file;
      if (isHeic) {
        const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
        blob = Array.isArray(result) ? result[0] : result;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setIsProcessing(false);
        setIsDeveloping(true);
        setZoom(1); 
        setTimeout(() => setIsDeveloping(false), 2500); 
      };
      reader.readAsDataURL(blob);
    } catch (err) { alert("Error processing image."); setIsProcessing(false); }
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    const container = img.parentElement;
    const scale = Math.max(container.offsetWidth / img.naturalWidth, container.offsetHeight / img.naturalHeight);
    const baseW = img.naturalWidth * scale;
    const baseH = img.naturalHeight * scale;
    setBaseDims({ w: baseW, h: baseH });
    setPosition({ x: (container.offsetWidth - baseW) / 2, y: (container.offsetHeight - baseH) / 2 });
  };

  useEffect(() => { if(image && imgRef.current) setPosition({x:0, y:0}); }, [format]);

  const handleSave = async () => {
    if (!image || !frameRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const targetWidth = currentFormat.exportWidth; 
    const frameEl = frameRef.current;
    const multiplier = targetWidth / frameEl.offsetWidth;
    const style = window.getComputedStyle(frameEl);
    const pLeft = parseFloat(style.paddingLeft) * multiplier;
    const pTop = parseFloat(style.paddingTop) * multiplier;
    const pBottom = parseFloat(style.paddingBottom) * multiplier;
    const photoWidth = targetWidth - (pLeft * 2);
    const maskEl = frameEl.querySelector('.mask-area');
    const maskAspect = maskEl.offsetHeight / maskEl.offsetWidth;
    const photoHeight = photoWidth * maskAspect;

    canvas.width = targetWidth;
    canvas.height = pTop + photoHeight + pBottom;

    // 1. PAPER
    ctx.fillStyle = frameColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Noise
    ctx.save();
    ctx.globalAlpha = 0.05;
    const noiseSize = 64; 
    for (let x = 0; x < canvas.width; x += noiseSize) {
        for (let y = 0; y < canvas.height; y += noiseSize) {
             ctx.fillStyle = (Math.random() > 0.5) ? '#000' : '#fff';
             ctx.fillRect(x, y, noiseSize, noiseSize);
        }
    }
    ctx.restore();

    // 2. PHOTO
    ctx.save();
    ctx.beginPath();
    ctx.rect(pLeft, pTop, photoWidth, photoHeight);
    ctx.clip();
    
    if (imgRef.current) {
        const imgEl = imgRef.current;
        const drawW = parseFloat(imgEl.style.width) * multiplier;
        const drawH = parseFloat(imgEl.style.height) * multiplier;
        const drawX = pLeft + (position.x * multiplier);
        const drawY = pTop + (position.y * multiplier);
        ctx.filter = filterStyles[activeFilter]; 
        ctx.drawImage(imgEl, drawX, drawY, drawW, drawH);
        ctx.filter = 'none';
    }

    if (showVignette) {
        const gradient = ctx.createRadialGradient(pLeft + photoWidth/2, pTop + photoHeight/2, photoWidth * 0.3, pLeft + photoWidth/2, pTop + photoHeight/2, photoWidth * 0.8);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = gradient;
        ctx.fillRect(pLeft, pTop, photoWidth, photoHeight);
    }

    if (showLeak) {
        ctx.globalCompositeOperation = 'screen';
        const gradient = ctx.createLinearGradient(pLeft, pTop, pLeft + photoWidth * 0.5, pTop + photoHeight);
        gradient.addColorStop(0, 'rgba(255, 150, 50, 0.4)'); 
        gradient.addColorStop(0.4, 'rgba(255, 100, 50, 0.2)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(pLeft, pTop, photoWidth, photoHeight);
        ctx.globalCompositeOperation = 'source-over';
    }

    // Inner Shadow
    ctx.lineWidth = 4 * multiplier;
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.strokeRect(pLeft, pTop, photoWidth, photoHeight);

    // Grain
    if (showGrain) { 
        const imageData = ctx.getImageData(pLeft, pTop, photoWidth, photoHeight);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 30;
            data[i] += noise; data[i+1] += noise; data[i+2] += noise;
        }
        ctx.putImageData(imageData, pLeft, pTop);
    }
    ctx.restore();

    // Tape
    if (showTape) {
        ctx.save();
        ctx.translate(canvas.width / 2, 0);
        ctx.rotate(0.02);
        ctx.fillStyle = "rgba(255, 255, 235, 0.6)"; 
        const tapeW = 160 * multiplier;
        const tapeH = 40 * multiplier;
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.fillRect(-tapeW / 2, -10, tapeW, tapeH);
        ctx.fillStyle = "rgba(255, 255, 240, 0.75)";
        ctx.fillRect(-tapeW / 2, -15, tapeW, tapeH);
        ctx.restore();
    }

    // Text
    if (showDate) {
        ctx.font = `bold ${20 * multiplier}px 'Courier New', monospace`;
        ctx.fillStyle = "rgba(255, 159, 67, 0.9)";
        ctx.textAlign = "right";
        ctx.fillText(dateStr, pLeft + photoWidth - (10), pTop + photoHeight - (15));
    }
    if (caption) {
        ctx.fillStyle = frameColor === '#2d3436' ? '#ffffff' : '#333333';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = fontType === 'hand' ? `${36 * multiplier}px 'Caveat', cursive` : `${28 * multiplier}px 'Cutive Mono', monospace`;
        ctx.fillText(caption, targetWidth / 2, pTop + photoHeight + (pBottom / 2));
    }

    const dataUrl = canvas.toDataURL('image/png');
    try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `polaroid-${Date.now()}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'My Polaroid' });
        } else {
            setGeneratedImage(dataUrl);
        }
    } catch (e) { setGeneratedImage(dataUrl); }
  };

  const handleDragStart = (e) => {
    if (!image) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };
  
  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPosition({ x: clientX - dragStart.x, y: clientY - dragStart.y });
    };
    const handleUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, dragStart]);

  const toggleDate = () => {
    if (!showDate) {
        const now = new Date();
        const y = String(now.getFullYear()).slice(-2);
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        setDateStr(`'${y} ${m} ${d}`);
    }
    setShowDate(!showDate);
  };

  const cycleFilter = () => {
    const keys = Object.keys(filterStyles);
    const nextIndex = (keys.indexOf(activeFilter) + 1) % keys.length;
    setActiveFilter(keys[nextIndex]);
  };

  const colors = ['#ffffff', '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#bdb2ff', '#2d3436'];

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 relative bg-slate-100/50 text-gray-800 overflow-x-hidden">
      
      {/* HEADER */}
      <div className="mb-6 font-semibold text-gray-400 tracking-widest text-sm uppercase flex items-center gap-2">
        Polaroid <span className="text-gray-800">Studio</span>
      </div>

      {/* FORMAT SWITCHER */}
      <div className="flex bg-white p-1 rounded-lg shadow-sm border border-gray-100 mb-8">
        {Object.keys(formatConfig).map((key) => (
            <button key={key} onClick={() => setFormat(key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${format === key ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                {formatConfig[key].icon}
                {formatConfig[key].label}
            </button>
        ))}
      </div>

      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTilt({x:0, y:0})}
        className="w-full flex flex-col items-center gap-8 perspective-[1200px]"
        style={{ perspective: '1200px' }}
      >
        
        {/* FRAME */}
        <div 
          ref={frameRef}
          className={`w-full relative select-none transition-all duration-300 ease-out ${currentFormat.frameClass}`}
          style={{ 
            backgroundColor: frameColor, 
            padding: currentFormat.padding, 
            borderRadius: '2px',
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            boxShadow: `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1), ${tilt.y * -2}px ${tilt.x * 2}px 20px rgba(0,0,0,0.15)`
          }}
        >
          {showTape && <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-yellow-50/60 rotate-1 shadow-sm backdrop-blur-[1px] z-20 pointer-events-none border border-white/40 mix-blend-hard-light"></div>}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}></div>

          {/* MASK */}
          <div 
            className={`mask-area w-full bg-neutral-100 overflow-hidden relative cursor-grab active:cursor-grabbing rounded-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] ${currentFormat.aspectClass}`}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
             {image ? (
                <>
                    <img 
                      ref={imgRef}
                      src={image} 
                      alt="Upload"
                      className="absolute max-w-none origin-top-left touch-none select-none pointer-events-none"
                      onLoad={handleImageLoad}
                      style={{
                        width: baseDims.w * zoom, 
                        height: baseDims.h * zoom,
                        transform: `translate(${position.x}px, ${position.y}px)`,
                        filter: isDeveloping ? 'brightness(0.2) sepia(1) blur(4px)' : filterStyles[activeFilter],
                        transition: isDeveloping ? 'none' : 'filter 3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    />
                    <div className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-[3000ms] ease-out ${isDeveloping ? 'opacity-100' : 'opacity-0'}`} />
                </>
             ) : (
                <div onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors cursor-pointer group">
                    {isProcessing ? (
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-purple-500 rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 shadow-inner group-hover:scale-110 transition-transform"><Camera size={24} className="opacity-50" /></div>
                            <span className="text-xs font-bold tracking-widest uppercase opacity-50">Tap to Load</span>
                        </>
                    )}
                </div>
             )}
             
             {showLeak && <div className="absolute inset-0 pointer-events-none mix-blend-screen opacity-60" style={{ background: 'linear-gradient(45deg, rgba(255,150,50,0.4) 0%, rgba(255,50,50,0.1) 40%, transparent 100%)' }}></div>}
             {showVignette && <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-80" style={{ background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.4) 100%)' }}></div>}
             {showGrain && <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>}
             
             {showDate && (
                 <input 
                    type="text"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="absolute bottom-4 right-4 text-[#ff9f43] font-bold text-lg font-mono tracking-widest opacity-80 drop-shadow-sm bg-transparent border-none outline-none text-right w-[150px] cursor-text hover:opacity-100 placeholder:text-[#ff9f43]/50 focus:opacity-100"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                 />
             )}
          </div>

          <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption..." maxLength={25}
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[85%] text-center bg-transparent border-none outline-none text-2xl placeholder:text-black/10`}
            style={{ fontFamily: fontType === 'hand' ? '"Caveat", cursive' : '"Cutive Mono", monospace', color: frameColor === '#2d3436' ? 'white' : '#333' }}
          />
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col items-center gap-3 w-full max-w-[90%]">
             {/* ZOOM */}
             {image && (
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm w-full max-w-[200px]">
                    <ZoomIn size={14} className="text-gray-400" />
                    <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full accent-gray-800 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                </div>
             )}

            <div className="flex flex-wrap justify-center gap-2 bg-white p-2 rounded-full shadow-lg shadow-gray-200/50 border border-gray-100">
                <button onClick={toggleDate} title="Date Stamp" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showDate ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'}`}><Calendar size={18} /></button>
                <button onClick={() => setShowVignette(!showVignette)} title="Vignette" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showVignette ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'}`}><CircleDashed size={18} /></button>
                <button onClick={() => setShowGrain(!showGrain)} title="Film Grain" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showGrain ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'}`}><Sparkles size={18} /></button>
                <button onClick={() => setShowLeak(!showLeak)} title="Light Leak" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showLeak ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'}`}><Sun size={18} /></button>
                <button onClick={() => setShowTape(!showTape)} title="Washi Tape" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showTape ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'}`}><StickyNote size={18} /></button>
                <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                <button onClick={() => setFontType(prev => prev === 'hand' ? 'type' : 'hand')} title="Switch Font" className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${fontType === 'type' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100'}`}><Type size={18} /></button>
                <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                <button onClick={cycleFilter} className="px-3 py-2 rounded-full bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 min-w-[70px] uppercase tracking-wide">{activeFilter === 'bw' ? 'B&W' : activeFilter}</button>
            </div>
        </div>

        {/* COLORS */}
        <div className="flex gap-3 overflow-x-auto py-4 px-2 w-full justify-center scrollbar-hide">
            {colors.map(c => <button key={c} onClick={() => setFrameColor(c)} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0 shadow-sm ${frameColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-4 w-full justify-center mt-2 pb-20">
             <button onClick={() => { setImage(null); setCaption(''); setPosition({x:0, y:0}); }} className="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-semibold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm bg-white"><RotateCcw size={16} /> Reset</button>
             <input ref={fileInputRef} type="file" accept="image/*, .heic, .heif" onChange={handleUpload} className="hidden" />
             {image ? (
                <button onClick={handleSave} className="flex-1 max-w-[160px] px-6 py-3 rounded-xl bg-gray-900 text-white font-semibold flex items-center justify-center gap-2 shadow-xl shadow-gray-900/20 hover:bg-black hover:-translate-y-1 transition-all"><Share size={16} /> Save</button>
             ) : (
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 max-w-[160px] px-6 py-3 rounded-xl bg-gray-200 text-gray-800 font-semibold flex items-center justify-center gap-2 hover:bg-gray-300 transition-colors"><Upload size={16} /> Photo</button>
             )}
        </div>
      </div>
      
      <canvas ref={canvasRef} className="hidden" />

      {generatedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
            <button onClick={() => setGeneratedImage(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2"><X size={32} /></button>
            <div className="text-white text-center mb-6 space-y-1"><p className="font-bold text-xl">Ready!</p><p className="text-sm text-neutral-400">Long-press image to Save to Photos</p></div>
            <img src={generatedImage} alt="Generated Polaroid" className="max-h-[60vh] w-auto shadow-2xl rounded-sm border border-white/10" />
            <a href={generatedImage} download={`polaroid-${Date.now()}.png`} className="mt-8 px-8 py-3 bg-white text-black rounded-full font-bold text-sm hover:bg-neutral-200 transition-colors flex items-center gap-2"><Download size={16} /> Download File</a>
        </div>
      )}
    </div>
  );
}

export default PolaroidStudio;