import type { BusinessProfileDTO, SettingsDTO } from "../../organization/dto/organization.dto";

export interface TokenPairDTO {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface SessionUserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branchId: string | null;
  branchName: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  mustChangePassword: boolean;
  /** Listed in PLATFORM_ADMIN_EMAILS — may open the cross-business platform view. */
  isPlatformAdmin: boolean;
}

export interface SessionDTO {
  user: SessionUserDTO;
  permissions: readonly string[];
  business: BusinessProfileDTO;
  settings: SettingsDTO;
}

export interface LoginResultDTO extends SessionDTO {
  tokens: TokenPairDTO;
}

export interface ClientContext {
  userAgent: string | null;
  ip: string | null;
}
