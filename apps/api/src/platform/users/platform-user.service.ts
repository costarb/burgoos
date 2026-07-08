import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PlatformUser, PlatformUserRole, Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { PrismaService } from "../database/prisma.service";
import { CreatePlatformUserDto, UpdatePlatformUserDto } from "./dto/platform-user.dto";

export interface PlatformUserSummary {
  id: string;
  name: string;
  email: string;
  role: PlatformUserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlatformUserFilters {
  search?: string;
  active?: boolean;
  role?: PlatformUserRole;
}

@Injectable()
export class PlatformUserService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: PlatformUserFilters = {}): Promise<PlatformUserSummary[]> {
    const where: Prisma.PlatformUserWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.active !== undefined) {
      where.active = filters.active;
    }

    if (filters.role) {
      where.role = filters.role;
    }

    const users = await this.prisma.platformUser.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return users.map((user) => this.toSummary(user));
  }

  async create(dto: CreatePlatformUserDto): Promise<PlatformUserSummary> {
    await this.assertUniqueEmail(dto.email);

    const user = await this.prisma.platformUser.create({
      data: {
        name: this.cleanText(dto.name),
        email: this.cleanEmail(dto.email),
        role: dto.role,
        active: dto.active ?? true,
        passwordHash: await hash(dto.temporaryPassword, 10),
      },
    });

    return this.toSummary(user);
  }

  async update(
    userId: string,
    dto: UpdatePlatformUserDto,
    actorUserId: string
  ): Promise<PlatformUserSummary> {
    const current = await this.findCurrent(userId);

    if (userId === actorUserId) {
      if (dto.active === false) {
        throw new BadRequestException("Voce nao pode desativar o proprio usuario de plataforma");
      }

      if (dto.role === PlatformUserRole.SUPPORT) {
        throw new BadRequestException("Voce nao pode remover o proprio perfil SUPER_ADMIN");
      }
    }

    await this.assertUpdateKeepsAdministrationAvailable(current, dto);

    if (dto.email && this.cleanEmail(dto.email) !== current.email) {
      await this.assertUniqueEmail(dto.email, userId);
    }

    const data: Prisma.PlatformUserUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = this.cleanText(dto.name);
    }

    if (dto.email !== undefined) {
      data.email = this.cleanEmail(dto.email);
    }

    if (dto.role !== undefined) {
      data.role = dto.role;
    }

    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    if (dto.temporaryPassword?.trim()) {
      data.passwordHash = await hash(dto.temporaryPassword, 10);
    }

    const user = await this.prisma.platformUser.update({
      where: { id: userId },
      data,
    });

    return this.toSummary(user);
  }

  private async assertUniqueEmail(email: string, ignoreUserId?: string): Promise<void> {
    const cleanEmail = this.cleanEmail(email);
    const [existingPlatformUser, existingStoreUser] = await Promise.all([
      this.prisma.platformUser.findUnique({
        where: { email: cleanEmail },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { email: cleanEmail },
        select: { id: true },
      }),
    ]);

    if (existingPlatformUser && existingPlatformUser.id !== ignoreUserId) {
      throw new ConflictException("Ja existe usuario de plataforma com este e-mail");
    }

    if (existingStoreUser) {
      throw new ConflictException("Este e-mail ja esta em uso por um usuario de loja");
    }
  }

  private async assertUpdateKeepsAdministrationAvailable(
    current: PlatformUser,
    dto: UpdatePlatformUserDto
  ): Promise<void> {
    if (current.role !== PlatformUserRole.SUPER_ADMIN || !current.active) {
      return;
    }

    if (dto.active !== false && dto.role !== PlatformUserRole.SUPPORT) {
      return;
    }

    const activeSuperAdmins = await this.prisma.platformUser.count({
      where: {
        active: true,
        role: PlatformUserRole.SUPER_ADMIN,
        id: { not: current.id },
      },
    });

    if (activeSuperAdmins === 0) {
      throw new BadRequestException("Mantenha ao menos um SUPER_ADMIN ativo na plataforma");
    }
  }

  private async findCurrent(userId: string): Promise<PlatformUser> {
    const current = await this.prisma.platformUser.findUnique({ where: { id: userId } });

    if (!current) {
      throw new NotFoundException("Usuario de plataforma nao encontrado");
    }

    return current;
  }

  private toSummary(user: PlatformUser): PlatformUserSummary {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private cleanText(value: string): string {
    return value.trim();
  }

  private cleanEmail(value: string): string {
    return value.trim().toLowerCase();
  }
}
