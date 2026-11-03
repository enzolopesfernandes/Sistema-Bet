import { PrismaClient } from "../generated/prisma/client";

const prismaClientSingleton = () => new PrismaClient();

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

globalThis.prismaGlobal = prisma;
