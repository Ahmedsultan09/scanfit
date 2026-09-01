/** Synthetic fixtures. No real names, financial records, or uploaded documents. */
export async function createSample(index = 0, noisy = false): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 1800;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#c6cbbb";
  c.fillRect(0, 0, 1400, 1800);
  c.shadowColor = "#37403035";
  c.shadowBlur = 24;
  c.shadowOffsetY = 12;
  c.fillStyle = "#fffdf7";
  c.fillRect(130, 100, 1140, 1600);
  c.shadowColor = "transparent";
  c.fillStyle = "#27664c";
  c.font = "bold 42px Georgia";
  c.fillText("FIELDNOTES", 215, 225);
  c.font = "20px Arial";
  c.fillStyle = "#647062";
  c.fillText("A synthetic document for testing • Not a real invoice", 215, 275);
  c.fillStyle = "#253129";
  c.font = "bold 65px Georgia";
  c.fillText(
    index === 0
      ? "Project invoice"
      : index === 1
        ? "Delivery note"
        : "Payment summary",
    215,
    415,
  );
  c.font = "24px Arial";
  c.fillText(`DOCUMENT 00${index + 1}     /     31 AUGUST 2026`, 215, 470);
  c.fillStyle = "#edf2e7";
  c.fillRect(215, 540, 970, 150);
  c.fillStyle = "#405840";
  c.font = "22px Arial";
  c.fillText("PREPARED FOR", 245, 587);
  c.font = "30px Georgia";
  c.fillText("Sample Studio", 245, 640);
  c.fillText("REFERENCE  /  DEMO-026", 730, 640);
  const rows = [
    ["Design research", "1", "450.00"],
    ["Interface development", "3", "900.00"],
    ["Documentation", "1", "180.00"],
  ];
  c.font = "bold 22px Arial";
  c.fillText("DESCRIPTION", 215, 780);
  c.fillText("QTY", 865, 780);
  c.fillText("AMOUNT", 1040, 780);
  rows.forEach((r, i) => {
    const y = 865 + i * 90;
    c.strokeStyle = "#dce3d4";
    c.beginPath();
    c.moveTo(215, y + 32);
    c.lineTo(1185, y + 32);
    c.stroke();
    c.font = "26px Arial";
    c.fillStyle = "#29362e";
    c.fillText(r[0], 215, y);
    c.fillText(r[1], 890, y);
    c.fillText(r[2], 1050, y);
  });
  c.font = "bold 38px Georgia";
  c.fillText("Total", 215, 1210);
  c.fillText("1,530.00", 1000, 1210);
  c.font = "22px Arial";
  c.fillStyle = "#65735f";
  c.fillText(
    "Thank you. This file is generated locally for demonstration.",
    215,
    1320,
  );
  c.font = "24px Arial";
  c.fillText("مستند تجريبي — لا يحتوي على بيانات شخصية", 215, 1370);
  c.strokeStyle = "#c85644";
  c.lineWidth = 4;
  c.strokeRect(925, 1450, 245, 105);
  c.fillStyle = "#c85644";
  c.font = "bold 28px Arial";
  c.fillText("SAMPLE ONLY", 948, 1514);
  c.fillStyle = "#47634e";
  c.font = "italic 34px Georgia";
  c.fillText("Fieldnotes Studio", 215, 1530);
  if (noisy) {
    const image = c.getImageData(215, 540, 700, 650);
    let seed = 17;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      image.data[i] = seed & 255;
      image.data[i + 1] = (seed >>> 8) & 255;
      image.data[i + 2] = (seed >>> 16) & 255;
    }
    c.putImageData(image, 215, 540);
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create a sample."))),
      "image/png",
    ),
  );
  canvas.width = canvas.height = 0;
  return new File([blob], `synthetic-${index + 1}.png`, { type: "image/png" });
}
