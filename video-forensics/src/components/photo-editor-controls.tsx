import { EditorState, defaultEditorState } from './photo-editor-types';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Undo2, Download } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/lib/use-language';

interface PhotoEditorControlsProps {
  state: EditorState;
  onChange: (updates: Partial<EditorState>) => void;
  onReset: () => void;
  onExport: () => void;
  disabled: boolean;
}

export function PhotoEditorControls({ state, onChange, onReset, onExport, disabled }: PhotoEditorControlsProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['transform', 'adjust', 'export']} className="w-full">
        {/* Transform & Crop */}
        <AccordionItem value="transform" className="border-border">
          <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider py-3 hover:no-underline">
            Transform & Crop
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pt-2 pb-4">
            <div className="flex gap-2 justify-between">
              <Button variant="outline" size="icon" className="h-8 w-8 flex-1" disabled={disabled} onClick={() => onChange({ rotation: (state.rotation - 90 + 360) % 360 })}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-1" disabled={disabled} onClick={() => onChange({ rotation: (state.rotation + 90) % 360 })}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-1" disabled={disabled} onClick={() => onChange({ flipH: !state.flipH })}>
                <FlipHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-1" disabled={disabled} onClick={() => onChange({ flipV: !state.flipV })}>
                <FlipVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-[10px] uppercase text-muted-foreground">Crop Top</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">{state.cropTop}%</span>
                </div>
                <Slider
                  disabled={disabled}
                  value={[state.cropTop]}
                  max={99 - state.cropBottom}
                  step={1}
                  onValueChange={([v]) => onChange({ cropTop: v })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-[10px] uppercase text-muted-foreground">Crop Bottom</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">{state.cropBottom}%</span>
                </div>
                <Slider
                  disabled={disabled}
                  value={[state.cropBottom]}
                  max={99 - state.cropTop}
                  step={1}
                  onValueChange={([v]) => onChange({ cropBottom: v })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-[10px] uppercase text-muted-foreground">Crop Left</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">{state.cropLeft}%</span>
                </div>
                <Slider
                  disabled={disabled}
                  value={[state.cropLeft]}
                  max={99 - state.cropRight}
                  step={1}
                  onValueChange={([v]) => onChange({ cropLeft: v })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-[10px] uppercase text-muted-foreground">Crop Right</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">{state.cropRight}%</span>
                </div>
                <Slider
                  disabled={disabled}
                  value={[state.cropRight]}
                  max={99 - state.cropLeft}
                  step={1}
                  onValueChange={([v]) => onChange({ cropRight: v })}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Adjustments */}
        <AccordionItem value="adjust" className="border-border">
          <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider py-3 hover:no-underline">
            Adjustments
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2 pb-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="text-[10px] uppercase text-muted-foreground">Brightness</Label>
                <span className="font-mono text-[10px] text-muted-foreground">{state.brightness}%</span>
              </div>
              <Slider
                disabled={disabled}
                value={[state.brightness]}
                max={200}
                step={1}
                onValueChange={([v]) => onChange({ brightness: v })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="text-[10px] uppercase text-muted-foreground">Contrast</Label>
                <span className="font-mono text-[10px] text-muted-foreground">{state.contrast}%</span>
              </div>
              <Slider
                disabled={disabled}
                value={[state.contrast]}
                max={200}
                step={1}
                onValueChange={([v]) => onChange({ contrast: v })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="text-[10px] uppercase text-muted-foreground">Saturation</Label>
                <span className="font-mono text-[10px] text-muted-foreground">{state.saturation}%</span>
              </div>
              <Slider
                disabled={disabled}
                value={[state.saturation]}
                max={200}
                step={1}
                onValueChange={([v]) => onChange({ saturation: v })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="text-[10px] uppercase text-muted-foreground">Grayscale</Label>
                <span className="font-mono text-[10px] text-muted-foreground">{state.grayscale}%</span>
              </div>
              <Slider
                disabled={disabled}
                value={[state.grayscale]}
                max={100}
                step={1}
                onValueChange={([v]) => onChange({ grayscale: v })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="text-[10px] uppercase text-muted-foreground">Sepia</Label>
                <span className="font-mono text-[10px] text-muted-foreground">{state.sepia}%</span>
              </div>
              <Slider
                disabled={disabled}
                value={[state.sepia]}
                max={100}
                step={1}
                onValueChange={([v]) => onChange({ sepia: v })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Export */}
        <AccordionItem value="export" className="border-border">
          <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider py-3 hover:no-underline">
            Export settings
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2 pb-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Format</Label>
              <Select
                disabled={disabled}
                value={state.exportFormat}
                onValueChange={(v: 'image/jpeg' | 'image/png' | 'image/webp') => onChange({ exportFormat: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image/jpeg">JPEG</SelectItem>
                  <SelectItem value="image/png">PNG</SelectItem>
                  <SelectItem value="image/webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {state.exportFormat !== 'image/png' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-[10px] uppercase text-muted-foreground">Quality</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">{state.exportQuality}%</span>
                </div>
                <Slider
                  disabled={disabled}
                  value={[state.exportQuality]}
                  max={100}
                  min={1}
                  step={1}
                  onValueChange={([v]) => onChange({ exportQuality: v })}
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid grid-cols-2 gap-2 pt-4">
        <Button variant="outline" size="sm" className="h-8 text-xs w-full" disabled={disabled} onClick={onReset}>
          <Undo2 className="h-3.5 w-3.5 mr-2" />
          Reset All
        </Button>
        <Button variant="default" size="sm" className="h-8 text-xs w-full" disabled={disabled} onClick={onExport}>
          <Download className="h-3.5 w-3.5 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}
