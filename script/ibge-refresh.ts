import { refreshIbgeAll, refreshIbgeUf } from "../server/ibge-municipios";

const args = process.argv.slice(2);
const ufArg =
  args.find((arg) => arg.startsWith("--uf="))?.split("=")[1] ||
  process.env.UF;

const run = async () => {
  if (ufArg) {
    const count = await refreshIbgeUf(ufArg);
    console.log(`IBGE atualizado para ${ufArg}: ${count ?? 0} municipios`);
    return;
  }
  const total = await refreshIbgeAll();
  console.log(`IBGE atualizado (todas UFs): ${total} municipios`);
};

run().catch((error) => {
  console.error("Falha ao atualizar IBGE:", error);
  process.exit(1);
});
