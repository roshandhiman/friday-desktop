import { BGPattern } from "@/components/ui/bg-pattern";

export default function DemoOne() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-8">
      <div className="relative flex aspect-video flex-col items-center justify-center rounded-2xl border-2">
        <BGPattern variant="grid" mask="fade-edges" />
        <h2 className="text-3xl font-bold">Grid Background</h2>
        <p className="font-mono text-muted-foreground">With (fade-edges) Mask</p>
      </div>
      <div className="relative flex aspect-video flex-col items-center justify-center rounded-2xl border-2">
        <BGPattern variant="dots" mask="fade-center" />
        <h2 className="text-3xl font-bold">Dots Background</h2>
        <p className="font-mono text-muted-foreground">With (fade-center) Mask</p>
      </div>
      <div className="relative flex aspect-video flex-col items-center justify-center rounded-2xl border-2">
        <BGPattern variant="diagonal-stripes" mask="fade-y" />
        <h2 className="text-3xl font-bold">Diagonal Stripes</h2>
        <p className="font-mono text-muted-foreground">With (fade-y) Mask</p>
      </div>
      <div className="relative flex aspect-video flex-col items-center justify-center rounded-2xl border-2">
        <BGPattern variant="horizontal-lines" mask="fade-right" />
        <h2 className="text-3xl font-bold">Horizontal Lines</h2>
        <p className="font-mono text-muted-foreground">With (fade-right) Mask</p>
      </div>
      <div className="relative flex aspect-video flex-col items-center justify-center rounded-2xl border-2">
        <BGPattern variant="vertical-lines" mask="fade-bottom" />
        <h2 className="text-3xl font-bold">Vertical Lines</h2>
        <p className="font-mono text-muted-foreground">With (fade-bottom) Mask</p>
      </div>
      <div className="relative flex aspect-video flex-col items-center justify-center rounded-2xl border-2">
        <BGPattern variant="checkerboard" mask="fade-top" />
        <h2 className="text-3xl font-bold">Checkerboard Background</h2>
        <p className="font-mono text-muted-foreground">With (fade-top) Mask</p>
      </div>
    </div>
  );
}
