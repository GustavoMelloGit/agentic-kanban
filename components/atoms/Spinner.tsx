import Icon, { type TamanhoDoIcone } from "./Icon";

export default function Spinner({ size = "md" }: { size?: TamanhoDoIcone }) {
  return <Icon name="girando" size={size} className="animate-spin" />;
}
