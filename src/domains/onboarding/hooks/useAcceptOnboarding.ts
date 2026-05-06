import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAuthStore } from "@/domains/auth/store";
import { postAgreement, type AgreementInput } from "../api/postAgreement";

export function useAcceptOnboarding(): UseMutationResult<void, Error, AgreementInput> {
  const updateUser = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: async (input) => {
      const { user } = await postAgreement(input);
      updateUser(user);
    },
  });
}
