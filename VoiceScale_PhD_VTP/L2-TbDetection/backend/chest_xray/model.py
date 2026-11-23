"""
chest_xray/model.py
DenseNet121-based binary classifier for TB detection from chest X-rays.
"""

from collections import OrderedDict
import torch
import torch.nn as nn

try:
    from torchvision import models
    _TORCHVISION_AVAILABLE = True
except ImportError:
    _TORCHVISION_AVAILABLE = False


# ── Pure PyTorch DenseNet-121 definition (when torchvision is absent) ────────
class _DenseLayer(nn.Module):
    def __init__(self, num_input_features, growth_rate, bn_size, drop_rate):
        super().__init__()
        self.norm1 = nn.BatchNorm2d(num_input_features)
        self.relu1 = nn.ReLU(inplace=True)
        self.conv1 = nn.Conv2d(num_input_features, bn_size * growth_rate, kernel_size=1, stride=1, bias=False)
        self.norm2 = nn.BatchNorm2d(bn_size * growth_rate)
        self.relu2 = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(bn_size * growth_rate, growth_rate, kernel_size=3, stride=1, padding=1, bias=False)
        self.drop_rate = float(drop_rate)

    def forward(self, init_features):
        features = [init_features] if isinstance(init_features, torch.Tensor) else init_features
        prev = torch.cat(features, 1)
        out = self.conv1(self.relu1(self.norm1(prev)))
        out = self.conv2(self.relu2(self.norm2(out)))
        if self.drop_rate > 0:
            out = nn.functional.dropout(out, p=self.drop_rate, training=self.training)
        return out


class _DenseBlock(nn.ModuleDict):
    def __init__(self, num_layers, num_input_features, bn_size, growth_rate, drop_rate):
        super().__init__()
        for i in range(num_layers):
            layer = _DenseLayer(num_input_features + i * growth_rate, growth_rate=growth_rate, bn_size=bn_size, drop_rate=drop_rate)
            self.add_module(f'denselayer{i + 1}', layer)

    def forward(self, init_features):
        features = [init_features]
        for name, layer in self.items():
            new_features = layer(features)
            features.append(new_features)
        return torch.cat(features, 1)


class _Transition(nn.Sequential):
    def __init__(self, num_input_features, num_output_features):
        super().__init__()
        self.norm = nn.BatchNorm2d(num_input_features)
        self.relu = nn.ReLU(inplace=True)
        self.conv = nn.Conv2d(num_input_features, num_output_features, kernel_size=1, stride=1, bias=False)
        self.pool = nn.AvgPool2d(kernel_size=2, stride=2)


class _PureDenseNet121(nn.Module):
    def __init__(self, growth_rate=32, block_config=(6, 12, 24, 16), num_init_features=64, bn_size=4, drop_rate=0):
        super().__init__()
        self.features = nn.Sequential(OrderedDict([
            ('conv0', nn.Conv2d(3, num_init_features, kernel_size=7, stride=2, padding=3, bias=False)),
            ('norm0', nn.BatchNorm2d(num_init_features)),
            ('relu0', nn.ReLU(inplace=True)),
            ('pool0', nn.MaxPool2d(kernel_size=3, stride=2, padding=1)),
        ]))
        num_features = num_init_features
        for i, num_layers in enumerate(block_config):
            block = _DenseBlock(num_layers=num_layers, num_input_features=num_features, bn_size=bn_size, growth_rate=growth_rate, drop_rate=drop_rate)
            self.features.add_module(f'denseblock{i + 1}', block)
            num_features = num_features + num_layers * growth_rate
            if i != len(block_config) - 1:
                trans = _Transition(num_input_features=num_features, num_output_features=num_features // 2)
                self.features.add_module(f'transition{i + 1}', trans)
                num_features = num_features // 2
        self.features.add_module('norm5', nn.BatchNorm2d(num_features))
        self.classifier = nn.Linear(num_features, 1000)

    def forward(self, x):
        features = self.features(x)
        out = nn.functional.relu(features, inplace=True)
        out = nn.functional.adaptive_avg_pool2d(out, (1, 1))
        out = torch.flatten(out, 1)
        out = self.classifier(out)
        return out


class ChestXrayModel(nn.Module):
    """
    DenseNet121 fine-tuned for binary TB classification.
    Final FC layer replaced with a 2-unit head for TB/Normal.
    """

    def __init__(self, pretrained: bool = True, num_classes: int = 1):
        super().__init__()

        if _TORCHVISION_AVAILABLE:
            weights = models.DenseNet121_Weights.IMAGENET1K_V1 if pretrained else None
            backbone = models.densenet121(weights=weights)
        else:
            backbone = _PureDenseNet121()

        # Keep all feature layers; replace classifier
        in_features = backbone.classifier.in_features
        backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(256, num_classes)   # single logit → sigmoid for binary
        )

        self.model = backbone

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)

    def freeze_backbone(self):
        """Freeze all layers except the classifier for Phase 1 training."""
        for name, param in self.model.named_parameters():
            if "classifier" not in name:
                param.requires_grad = False

    def unfreeze_last_denseblock(self):
        """
        Phase 2: Unfreeze the last DenseBlock + transition for fine-tuning.
        DenseNet121 blocks: denseblock1 … denseblock4 + transition1 … norm5
        """
        layers_to_unfreeze = ["denseblock4", "norm5", "classifier"]
        for name, param in self.model.named_parameters():
            if any(layer in name for layer in layers_to_unfreeze):
                param.requires_grad = True

    def unfreeze_all(self):
        """Unfreeze every parameter."""
        for param in self.model.parameters():
            param.requires_grad = True

    def get_trainable_params(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def get_total_params(self) -> int:
        return sum(p.numel() for p in self.parameters())


def build_model(pretrained: bool = True) -> ChestXrayModel:
    """Factory function – returns a freshly initialised model."""
    return ChestXrayModel(pretrained=pretrained)
