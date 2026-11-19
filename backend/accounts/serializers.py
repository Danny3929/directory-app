from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import Profile


class RegisterSerializer(serializers.Serializer):
    """Only these three fields are read from the request. Anything else the
    client sends (is_staff, username, ...) is simply ignored."""

    email = serializers.EmailField(max_length=254)
    # write_only: the password goes in, it never comes back out.
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    role = serializers.ChoiceField(choices=Profile.Role.choices)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        # Django's own validators: length, too common, all numbers, too like the email.
        # They need the user to compare against, so we build an unsaved one.
        candidate = User(username=attrs["email"], email=attrs["email"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        email = validated_data["email"]
        try:
            with transaction.atomic():  # user and profile are saved together, or not at all
                # The email doubles as the username (which the database keeps unique),
                # so login later can use the email.
                user = User.objects.create_user(username=email, email=email, password=validated_data["password"])
                Profile.objects.create(user=user, role=validated_data["role"])
        except IntegrityError:
            # Two sign-ups with the same email at the same moment: both passed
            # validate_email, the database stops the second one.
            raise serializers.ValidationError({"email": ["An account with this email already exists."]})
        return user

    def to_representation(self, user):
        return {"id": user.id, "email": user.email, "role": user.profile.role}
