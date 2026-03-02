import { createSignal } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";

import { useClient } from "@revolt/client";
import { useNavigate } from "@revolt/routing";
import { Dialog, DialogProps } from "@revolt/ui";

import { MFACancelledError, useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to delete a server
 */
export function DeleteServerModal(
  props: DialogProps & Modals & { type: "delete_server" },
) {
  const client = useClient();
  const navigate = useNavigate();
  const { showError, mfaFlow, closeAll } = useModals();
  const [pending, setPending] = createSignal(false);

  async function onDelete() {
    try {
      setPending(true);
      const mfa = await client().account.mfa();
      await mfaFlow(mfa as never);
      await props.server.delete(); // TODO: should use ticket in API
      navigate("/");
      setTimeout(() => closeAll(), 0);
    } catch (error) {
      setPending(false);
      if (error instanceof MFACancelledError) return;
      showError(error);
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Delete {props.server.name}?</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Delete</Trans>,
          onClick: () => onDelete(),
        },
      ]}
      isDisabled={pending()}
    >
      <Trans>Once it's deleted, there's no going back.</Trans>
    </Dialog>
  );
}
