import RegionalPanel from "./RegionalPanel";
import type { AnalysisArea, EconomicsInputs, FruitKey } from "../lib/types";
type Props = {
  area: AnalysisArea;
  fruit: FruitKey;
  onEconomicsChange: (value: Partial<EconomicsInputs>) => void;
  onRetry: () => void;
};
export default function OpenDataPanel(props: Props) {
  return <RegionalPanel {...props} />;
}
