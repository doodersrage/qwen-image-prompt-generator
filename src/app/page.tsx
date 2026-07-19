import PageCanvas from "@/components/ui/PageCanvas";
import HomeDashboard from "@/components/HomeDashboard";
import PromptGenerator from "@/components/PromptGenerator";

export default function Home() {
  return (
    <PageCanvas accent="violet">
      <HomeDashboard />
      <PromptGenerator />
    </PageCanvas>
  );
}
