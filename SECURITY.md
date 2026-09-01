# Security policy

## Supported versions

ScanFit has not published a stable package. Security fixes currently target the latest commit on `main`; no registry version receives long-term support yet.

## Report a vulnerability privately

Use GitHub's **Report a vulnerability** form in the repository Security tab. Do not open a public issue for a suspected security or privacy problem.

Include:

- the affected commit or version;
- browser and operating system;
- a minimal reproduction using synthetic data;
- expected and observed behavior;
- the potential effect on document confidentiality, integrity, availability or host applications.

Do not attach real identity documents, signatures, applications or other personal files. The maintainer will acknowledge a complete report, investigate it and coordinate disclosure after a fix is available. Response times are not guaranteed while the project remains an unpaid alpha.

## Scope

Useful reports include malformed-image handling, metadata leakage, unexpected network or persistence behavior, worker-boundary failures, PDF content disclosure, dependency compromise and ways to bypass configured safety limits.

The security policy does not turn the alpha into a certified secure document processor. Host applications and their third-party scripts share the page environment and remain responsible for their own storage, upload and access controls.
